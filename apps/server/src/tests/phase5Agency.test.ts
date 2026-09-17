process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDb, closeDb } from '../db';
import { PermissionService } from '../services/agency/permissionService';
import { IdempotencyService } from '../services/agency/idempotencyService';
import { ActionStateMachine } from '../services/agency/actionStateMachine';
import { toolRouter, CalendarTool, CommunicationTool, PersonalModelTool } from '../services/agency/toolRouter';
import { calendarAdapter } from '../services/calendar/calendarAdapter';
import { PersonalModelService } from '../services/personalModel/personalModelService';
import type { Action, Permission, OrionTool, ToolResult, VerificationResult } from '@orion/types';

describe('Orion Build Spec V1 — Phase 5 Agency, Permissions & Verification Tests', () => {
  const userId = 'user_ben_phase5';
  let server: http.Server;
  let app: any;
  const testPort = 3011;

  before(async () => {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, display_name, timezone, locale, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Ben (Phase 5 Test)', 'Europe/London', 'en-GB', '{}', now, now]
    );

    // Initialize clean state for user
    await PersonalModelService.updateCurrentState(userId, {
      current_focus: 'Orion Phase 5 Agency Verification',
      available_time_window: 120
    });

    // Dynamic import to honor NODE_ENV=test
    const indexModule = await import('../index');
    app = indexModule.default;

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(testPort, () => resolve());
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const db = await getDb();
    await db.run('DELETE FROM permissions WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM actions WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM calendar_events WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM outcomes WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM current_state WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await closeDb();
  });

  // ─── 1. Permission Model & Scopes ──────────────────────────────────────────
  describe('1. Permission Model & Revocation', () => {
    let permId: string;

    it('grants a scoped permission and stores it in SQLite', async () => {
      const perm = await PermissionService.grantPermission({
        user_id: userId,
        tool: 'calendar',
        capability: 'create_event',
        risk_level: 'MEDIUM',
        mode: 'ALWAYS',
        scope: { calendar: 'work' }
      });

      assert.ok(perm.id);
      assert.strictEqual(perm.tool, 'calendar');
      assert.strictEqual(perm.capability, 'create_event');
      assert.strictEqual(perm.risk_level, 'MEDIUM');
      assert.strictEqual(perm.mode, 'ALWAYS');
      assert.strictEqual(perm.status, 'ACTIVE');
      permId = perm.id;
    });

    it('lists active permissions for user', async () => {
      const permissions = await PermissionService.listPermissions(userId);
      assert.ok(permissions.length >= 1);
      assert.ok(permissions.some((p) => p.id === permId));
    });

    it('revokes an existing permission', async () => {
      const revoked = await PermissionService.revokePermission(userId, permId);
      assert.strictEqual(revoked, true);

      const perm = await PermissionService.getPermission(userId, permId);
      assert.strictEqual(perm?.status, 'REVOKED');
    });

    it('handles expired permissions correctly', async () => {
      // Grant permission with past expiry timestamp
      const expiredPerm = await PermissionService.grantPermission({
        user_id: userId,
        tool: 'calendar',
        capability: 'delete_event',
        risk_level: 'HIGH',
        expires_at: new Date(Date.now() - 60000).toISOString()
      });

      const check = await PermissionService.checkPermission(
        userId,
        'calendar',
        'delete_event',
        'HIGH'
      );

      assert.strictEqual(check.allowed, false);
      assert.strictEqual(check.requiresApproval, true);

      // Verify permission was marked EXPIRED
      const updated = await PermissionService.getPermission(userId, expiredPerm.id);
      assert.strictEqual(updated?.status, 'EXPIRED');
    });
  });

  // ─── 2. Risk Classification & Authorization Gate ───────────────────────────
  describe('2. Risk Classification & Authorization Gate', () => {
    it('halts HIGH-risk actions at WAITING_APPROVAL without authorization', async () => {
      const action = await ActionStateMachine.proposeAction(userId, {
        description: 'Send quarterly progress update to investors',
        tool: 'communication',
        capability: 'send_email',
        payload: {
          to: 'investors@example.com',
          subject: 'Q4 2026 Progress',
          body: 'All key outcomes on track.'
        }
      });

      assert.strictEqual(action.risk_level, 'HIGH');
      assert.strictEqual(action.status, 'WAITING_APPROVAL');
      assert.ok(action.authorization?.includes('High-risk action'));
    });

    it('halts MEDIUM-risk actions without permission at WAITING_APPROVAL', async () => {
      const action = await ActionStateMachine.proposeAction(userId, {
        description: 'Schedule follow-up meeting',
        tool: 'calendar',
        capability: 'create_event',
        payload: {
          title: 'Unpermitted Meeting',
          start_time: '2026-09-22T10:00:00.000Z',
          end_time: '2026-09-22T10:30:00.000Z'
        }
      });

      assert.strictEqual(action.risk_level, 'MEDIUM');
      assert.strictEqual(action.status, 'WAITING_APPROVAL');
    });

    it('allows LOW-risk actions to advance to READY without manual prompt', async () => {
      const action = await ActionStateMachine.proposeAction(userId, {
        description: 'Draft internal outcome definition',
        tool: 'personal_model',
        capability: 'create_outcome',
        payload: {
          title: 'Low Risk Outcome',
          desired_result: 'Verified outcome creation'
        }
      });

      assert.strictEqual(action.risk_level, 'LOW');
      assert.strictEqual(action.status, 'READY');
    });
  });

  // ─── 3. Action State Machine & One-Time Permission Consumption ─────────────
  describe('3. Action State Machine & One-Time Permissions', () => {
    it('executes action with ONE_TIME permission and consumes the grant', async () => {
      // 1. Grant ONE_TIME permission for email dispatch
      const perm = await PermissionService.grantPermission({
        user_id: userId,
        tool: 'communication',
        capability: 'send_email',
        risk_level: 'HIGH',
        mode: 'ONE_TIME'
      });

      // 2. Propose action: should be READY because ONE_TIME permission exists
      const action = await ActionStateMachine.proposeAction(userId, {
        description: 'Send one-time notification',
        tool: 'communication',
        capability: 'send_email',
        payload: {
          to: 'partner@example.com',
          subject: 'One-time confirmation',
          body: 'Confirmed schedule.'
        }
      });

      assert.strictEqual(action.status, 'READY');
      assert.ok(action.authorization?.includes(perm.id));

      // 3. Execute action
      const execution = await ActionStateMachine.executeAction(userId, action.id);
      assert.strictEqual(execution.action.status, 'COMPLETED');
      assert.strictEqual(execution.verification.verified, true);

      // 4. Verify ONE_TIME permission was consumed (REVOKED)
      const consumedPerm = await PermissionService.getPermission(userId, perm.id);
      assert.strictEqual(consumedPerm?.status, 'REVOKED', 'ONE_TIME permission must be revoked upon completion');

      // 5. Proposing another action now must require approval (no leakage)
      const secondAction = await ActionStateMachine.proposeAction(userId, {
        description: 'Send second unauthorized notification',
        tool: 'communication',
        capability: 'send_email',
        payload: {
          to: 'partner@example.com',
          subject: 'Another email',
          body: 'Should not bypass authorization.'
        }
      });

      assert.strictEqual(secondAction.status, 'WAITING_APPROVAL', 'Must require approval once one-time grant is consumed');
    });
  });

  // ─── 4. Verification Protocol & Failure Handling ───────────────────────────
  describe('4. Post-Execution Verification Protocol', () => {
    it('verifies calendar event creation by querying SQLite before marking COMPLETED', async () => {
      // Grant permission for calendar creation
      await PermissionService.grantPermission({
        user_id: userId,
        tool: 'calendar',
        capability: 'create_event',
        risk_level: 'MEDIUM',
        mode: 'ALWAYS'
      });

      const action = await ActionStateMachine.proposeAction(userId, {
        description: 'Book Architecture Focus Block',
        tool: 'calendar',
        capability: 'create_event',
        payload: {
          title: 'Verified Focus Block',
          start_time: '2026-09-22T14:00:00.000Z',
          end_time: '2026-09-22T15:30:00.000Z',
          location: 'Lab Room 2'
        }
      });

      assert.strictEqual(action.status, 'READY');

      const execution = await ActionStateMachine.executeAction(userId, action.id);
      assert.strictEqual(execution.action.status, 'COMPLETED');
      assert.strictEqual(execution.verification.verified, true);
      assert.ok(execution.verification.details?.includes('Verified calendar event'));

      // Double-check event exists in real SQLite table
      const createdEventId = (execution.result.data as any)?.id;
      const dbEvent = await calendarAdapter.getEventById(userId, createdEventId);
      assert.ok(dbEvent);
      assert.strictEqual(dbEvent.title, 'Verified Focus Block');
    });

    it('transitions to FAILED if post-execution verification fails (never reports false completion)', async () => {
      // Register a mock faulty tool that reports success but fails verification
      const faultyTool: OrionTool = {
        name: 'faulty_tool',
        capabilities: () => [
          {
            name: 'fake_action',
            description: 'Action that lies about completion',
            inputSchema: {},
            riskLevel: 'LOW',
            reversible: true
          }
        ],
        execute: async () => ({
          success: true,
          status: 'SUCCESS',
          source: 'faulty_tool',
          data: { claim: 'Done' }
        }),
        verify: async () => ({
          verified: false,
          details: 'Physical verification failed: Deliverable missing from filesystem',
          timestamp: new Date().toISOString()
        })
      };

      toolRouter.registerTool(faultyTool);

      const action = await ActionStateMachine.proposeAction(userId, {
        description: 'Execute unreliable action',
        tool: 'faulty_tool',
        capability: 'fake_action',
        riskLevel: 'LOW'
      });

      const execution = await ActionStateMachine.executeAction(userId, action.id);
      assert.strictEqual(execution.action.status, 'FAILED');
      assert.strictEqual(execution.verification.verified, false);
      assert.ok(execution.action.error?.includes('Verification failed'));
    });
  });

  // ─── 5. Idempotency & Duplicate Protection ─────────────────────────────────
  describe('5. Idempotency & Duplicate Protection', () => {
    it('returns existing completed action when identical payload is submitted', async () => {
      const payload = {
        to: 'founder@example.com',
        subject: 'Weekly Review',
        body: 'Deterministic idempotency check'
      };

      // 1. Propose and approve first action
      const action1 = await ActionStateMachine.proposeAction(userId, {
        description: 'Send weekly review email',
        tool: 'communication',
        capability: 'send_email',
        payload
      });

      await ActionStateMachine.approveAction(userId, action1.id);
      const completed1 = await ActionStateMachine.getAction(userId, action1.id);
      assert.strictEqual(completed1?.status, 'COMPLETED');

      // 2. Submit identical action: must return original action without re-execution
      const action2 = await ActionStateMachine.proposeAction(userId, {
        description: 'Send weekly review email duplicate attempt',
        tool: 'communication',
        capability: 'send_email',
        payload
      });

      assert.strictEqual(action2.id, action1.id, 'Must return identical action ID due to idempotency');
      assert.strictEqual(action2.status, 'COMPLETED');
    });
  });

  // ─── 6. User Rejection Flow ────────────────────────────────────────────────
  describe('6. User Rejection Handling', () => {
    it('transitions to FAILED with user reason when rejected', async () => {
      const action = await ActionStateMachine.proposeAction(userId, {
        description: 'High impact database wipe',
        tool: 'communication',
        capability: 'send_email',
        payload: { to: 'nobody@example.com', subject: 'test', body: 'test' }
      });

      assert.strictEqual(action.status, 'WAITING_APPROVAL');

      const rejected = await ActionStateMachine.rejectAction(userId, action.id, 'User refused risk');
      assert.strictEqual(rejected.status, 'CANCELLED');
      assert.ok(rejected.error?.includes('User refused risk'));
    });
  });

  // ─── 7. Agency REST API Endpoints ──────────────────────────────────────────
  describe('7. Agency REST API Endpoints', () => {
    async function request(options: {
      method: string;
      path: string;
      body?: any;
    }): Promise<{ status: number; data: any }> {
      return new Promise((resolve, reject) => {
        const postData = options.body ? JSON.stringify(options.body) : '';
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: options.path,
            method: options.method,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve({ status: res.statusCode || 200, data: parsed });
              } catch {
                resolve({ status: res.statusCode || 200, data: body });
              }
            });
          }
        );
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
      });
    }

    let httpPermId: string;
    let httpActionId: string;

    it('POST /api/agency/permissions grants a permission via HTTP', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/agency/permissions',
        body: {
          user_id: userId,
          tool: 'calendar',
          capability: 'create_event',
          risk_level: 'MEDIUM',
          mode: 'ALWAYS'
        }
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.permission.id);
      httpPermId = res.data.permission.id;
    });

    it('GET /api/agency/permissions lists permissions via HTTP', async () => {
      const res = await request({
        method: 'GET',
        path: `/api/agency/permissions?userId=${userId}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.permissions));
      assert.ok(res.data.permissions.some((p: any) => p.id === httpPermId));
    });

    it('GET /api/agency/tools lists registered capabilities via HTTP', async () => {
      const res = await request({
        method: 'GET',
        path: '/api/agency/tools'
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.capabilities));
      assert.ok(res.data.capabilities.some((c: any) => c.name === 'create_event'));
    });

    it('POST /api/agency/actions proposes an action via HTTP', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/agency/actions',
        body: {
          user_id: userId,
          description: 'HTTP Proposed Email Action',
          tool: 'communication',
          capability: 'send_email',
          payload: {
            to: 'client@example.com',
            subject: 'HTTP Test',
            body: 'Testing agency approval endpoints'
          }
        }
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.action.status, 'WAITING_APPROVAL');
      httpActionId = res.data.action.id;
    });

    it('GET /api/agency/actions/:id retrieves action by ID via HTTP', async () => {
      const res = await request({
        method: 'GET',
        path: `/api/agency/actions/${httpActionId}?userId=${userId}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.action.id, httpActionId);
    });

    it('POST /api/agency/actions/:id/approve approves and executes via HTTP', async () => {
      const res = await request({
        method: 'POST',
        path: `/api/agency/actions/${httpActionId}/approve`,
        body: { user_id: userId }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.action.status, 'COMPLETED');
      assert.strictEqual(res.data.verification.verified, true);
    });

    it('DELETE /api/agency/permissions/:id revokes permission via HTTP', async () => {
      const res = await request({
        method: 'DELETE',
        path: `/api/agency/permissions/${httpPermId}?userId=${userId}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.revoked, true);
    });
  });
});
