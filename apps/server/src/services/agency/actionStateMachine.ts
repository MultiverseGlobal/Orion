import crypto from 'crypto';
import { getDb } from '../../db';
import { PermissionService } from './permissionService';
import { IdempotencyService } from './idempotencyService';
import { toolRouter } from './toolRouter';
import type {
  Action,
  ActionStatus,
  RiskLevel,
  ToolResult,
  VerificationResult
} from '@orion/types';

export class ActionStateMachine {
  /**
   * Proposes a new action and runs the authorization check.
   * Advances from PROPOSED -> PERMISSION_CHECK -> WAITING_APPROVAL | READY.
   */
  static async proposeAction(
    userId: string,
    params: {
      description: string;
      tool?: string;
      capability?: string;
      payload?: Record<string, any>;
      outcomeId?: string;
      actor?: 'USER' | 'ORION' | 'SHARED';
      riskLevel?: RiskLevel;
    }
  ): Promise<Action> {
    const db = await getDb();
    const actionId = `act_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const actor = params.actor || 'ORION';
    const tool = params.tool || null;
    const capability = params.capability || null;
    const payload = params.payload || {};

    // 1. Determine risk level from tool capability or explicit param
    let riskLevel: RiskLevel = params.riskLevel || 'MEDIUM';
    if (tool && capability) {
      const cap = toolRouter.getCapability(tool, capability);
      if (cap) {
        riskLevel = cap.riskLevel;
      }
    }

    // 2. Idempotency check: prevent duplicate actions (Section 10.5)
    let idempotencyKey: string | null = null;
    if (tool && capability) {
      idempotencyKey = IdempotencyService.generateKey(tool, capability, payload);
      const duplicate = await IdempotencyService.findDuplicate(userId, idempotencyKey);
      if (duplicate) {
        return duplicate;
      }
    }

    // 3. Insert in PROPOSED state
    await db.run(
      `INSERT INTO actions (id, user_id, outcome_id, description, actor, tool, capability, payload, idempotency_key, risk_level, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROPOSED', ?)`,
      [
        actionId,
        userId,
        params.outcomeId || null,
        params.description,
        actor,
        tool,
        capability,
        JSON.stringify(payload),
        idempotencyKey,
        riskLevel,
        now
      ]
    );

    // 4. PERMISSION_CHECK: evaluate permissions and risk gate
    if (tool && capability) {
      const permCheck = await PermissionService.checkPermission(
        userId,
        tool,
        capability,
        riskLevel,
        payload
      );

      if (permCheck.requiresApproval) {
        // High-impact or unpermitted actions pause at WAITING_APPROVAL
        await this.updateStatus(actionId, 'WAITING_APPROVAL', {
          authorization: permCheck.reason
        });
      } else {
        // Pre-authorized or low-risk actions proceed to READY
        await this.updateStatus(actionId, 'READY', {
          authorization: permCheck.permission ? `Permission: ${permCheck.permission.id}` : 'Implicit Low Risk'
        });
      }
    } else {
      // General task without tool binding
      await this.updateStatus(actionId, 'READY');
    }

    const created = await this.getAction(userId, actionId);
    if (!created) throw new Error(`Failed to create action ${actionId}`);
    return created;
  }

  /**
   * User explicitly approves a pending action.
   * Advances WAITING_APPROVAL -> READY -> EXECUTING -> VERIFYING -> COMPLETED / FAILED.
   */
  static async approveAction(
    userId: string,
    actionId: string
  ): Promise<{ action: Action; result: ToolResult; verification: VerificationResult }> {
    const action = await this.getAction(userId, actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    if (action.status !== 'WAITING_APPROVAL' && action.status !== 'READY') {
      throw new Error(`Cannot approve action in status: ${action.status}`);
    }

    await this.updateStatus(actionId, 'READY', {
      authorization: 'EXPLICIT_USER_APPROVAL'
    });

    return this.executeAction(userId, actionId);
  }

  /**
   * User explicitly rejects a pending action.
   * Advances WAITING_APPROVAL -> FAILED (with rejection note).
   */
  static async rejectAction(userId: string, actionId: string, reason?: string): Promise<Action> {
    const action = await this.getAction(userId, actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    const now = new Date().toISOString();
    await this.updateStatus(actionId, 'CANCELLED', {
      completed_at: now,
      error: `Rejected by user: ${reason || 'User declined approval'}`
    });

    const updated = await this.getAction(userId, actionId);
    return updated!;
  }

  /**
   * Executes a READY action through the tool layer and enforces post-execution verification.
   * Enforces Section 10.4: "Never report success before verification."
   */
  static async executeAction(
    userId: string,
    actionId: string
  ): Promise<{ action: Action; result: ToolResult; verification: VerificationResult }> {
    const action = await this.getAction(userId, actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    if (action.status !== 'READY') {
      throw new Error(`Action ${actionId} is not in READY state (current: ${action.status})`);
    }

    const now = new Date().toISOString();

    // 1. Transition to EXECUTING
    await this.updateStatus(actionId, 'EXECUTING', { started_at: now });

    if (!action.tool || !action.capability) {
      // Manual action without automated tool execution
      const verification: VerificationResult = { verified: true, timestamp: now };
      await this.updateStatus(actionId, 'COMPLETED', {
        completed_at: now,
        verification_result: verification
      });
      const updated = (await this.getAction(userId, actionId))!;
      return {
        action: updated,
        result: { success: true, status: 'MANUAL_COMPLETED', source: 'user' },
        verification
      };
    }

    const tool = toolRouter.getTool(action.tool);
    if (!tool) {
      const errMessage = `Tool [${action.tool}] not registered in tool router`;
      await this.updateStatus(actionId, 'FAILED', {
        completed_at: now,
        error: errMessage
      });
      const updated = (await this.getAction(userId, actionId))!;
      return {
        action: updated,
        result: { success: false, status: 'TOOL_NOT_FOUND', source: 'router', error: { code: 'NO_TOOL', message: errMessage } },
        verification: { verified: false, details: errMessage, timestamp: now }
      };
    }

    // 2. Run Tool Execution
    let result: ToolResult;
    try {
      result = await tool.execute(action.capability, {
        userId,
        ...(action.payload || {})
      });
    } catch (err: any) {
      result = {
        success: false,
        status: 'EXECUTION_ERROR',
        source: action.tool,
        error: { code: 'EXEC_ERROR', message: err.message || String(err) }
      };
    }

    // 3. Transition to VERIFYING & Run Verification Check
    await this.updateStatus(actionId, 'VERIFYING');
    let verification: VerificationResult;
    try {
      verification = await tool.verify(action.capability, result);
    } catch (err: any) {
      verification = {
        verified: false,
        details: `Verification threw exception: ${err.message}`,
        timestamp: new Date().toISOString()
      };
    }

    const completionTime = new Date().toISOString();

    // 4. Invariant: Only mark COMPLETED if verification succeeds!
    if (result.success && verification.verified) {
      await this.updateStatus(actionId, 'COMPLETED', {
        completed_at: completionTime,
        verification_result: verification
      });

      // If action was authorized by a ONE_TIME permission, consume it now
      if (action.authorization?.startsWith('Permission: ')) {
        const permId = action.authorization.replace('Permission: ', '').trim();
        await PermissionService.consumeOneTimePermission(userId, permId);
      }
    } else {
      const failureReason = !result.success
        ? `Execution failed: ${result.error?.message || result.status}`
        : `Verification failed: ${verification.details}`;

      await this.updateStatus(actionId, 'FAILED', {
        completed_at: completionTime,
        verification_result: verification,
        error: failureReason
      });
    }

    const updated = (await this.getAction(userId, actionId))!;
    return {
      action: updated,
      result,
      verification
    };
  }

  /**
   * Fetch an action by ID.
   */
  static async getAction(userId: string, actionId: string): Promise<Action | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM actions WHERE id = ? AND user_id = ?', [actionId, userId]);
    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * List actions for a user with optional status filter.
   */
  static async listActions(userId: string, status?: ActionStatus): Promise<Action[]> {
    const db = await getDb();
    let query = 'SELECT * FROM actions WHERE user_id = ?';
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const rows = await db.all(query, params);
    return rows.map((r) => this.mapRow(r));
  }

  private static async updateStatus(
    actionId: string,
    status: ActionStatus,
    patch?: {
      started_at?: string;
      completed_at?: string;
      authorization?: string;
      verification_result?: VerificationResult;
      error?: string;
    }
  ): Promise<void> {
    const db = await getDb();
    const updates = ['status = ?'];
    const values: any[] = [status];

    if (patch?.started_at !== undefined) {
      updates.push('started_at = ?');
      values.push(patch.started_at);
    }
    if (patch?.completed_at !== undefined) {
      updates.push('completed_at = ?');
      values.push(patch.completed_at);
    }
    if (patch?.authorization !== undefined) {
      updates.push('authorization = ?');
      values.push(patch.authorization);
    }
    if (patch?.verification_result !== undefined) {
      updates.push('verification_result = ?');
      values.push(JSON.stringify(patch.verification_result));
    }
    if (patch?.error !== undefined) {
      updates.push('error = ?');
      values.push(patch.error);
    }

    values.push(actionId);
    await db.run(`UPDATE actions SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  private static mapRow(row: any): Action {
    return {
      id: row.id,
      user_id: row.user_id,
      outcome_id: row.outcome_id,
      description: row.description,
      actor: row.actor,
      tool: row.tool,
      capability: row.capability,
      payload: row.payload ? JSON.parse(row.payload) : {},
      idempotency_key: row.idempotency_key,
      risk_level: row.risk_level,
      authorization: row.authorization,
      status: row.status as ActionStatus,
      verification_result: row.verification_result ? JSON.parse(row.verification_result) : null,
      error: row.error,
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at
    };
  }
}
