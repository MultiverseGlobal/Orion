import crypto from 'crypto';
import { getDb } from '../../db';
import type { Permission, RiskLevel } from '@orion/types';

export class PermissionService {
  /**
   * Grant a scoped permission.
   */
  static async grantPermission(grant: {
    user_id: string;
    tool: string;
    capability: string;
    scope?: Record<string, any> | null;
    risk_level?: RiskLevel;
    mode?: 'ONE_TIME' | 'SESSION' | 'ALWAYS' | string;
    conditions?: Record<string, any> | null;
    expires_at?: string | null;
  }): Promise<Permission> {
    const db = await getDb();
    const id = `perm_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const riskLevel = grant.risk_level || 'MEDIUM';
    const mode = grant.mode || 'ONE_TIME';

    await db.run(
      `INSERT INTO permissions (id, user_id, tool, capability, scope, risk_level, mode, conditions, expires_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [
        id,
        grant.user_id,
        grant.tool,
        grant.capability,
        grant.scope ? JSON.stringify(grant.scope) : '{}',
        riskLevel,
        mode,
        grant.conditions ? JSON.stringify(grant.conditions) : '{}',
        grant.expires_at || null,
        now
      ]
    );

    return {
      id,
      user_id: grant.user_id,
      tool: grant.tool,
      capability: grant.capability,
      scope: grant.scope || {},
      risk_level: riskLevel,
      mode,
      conditions: grant.conditions || {},
      expires_at: grant.expires_at || null,
      status: 'ACTIVE',
      created_at: now
    };
  }

  /**
   * Revoke an active permission.
   */
  static async revokePermission(userId: string, permissionId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.run(
      "UPDATE permissions SET status = 'REVOKED' WHERE id = ? AND user_id = ?",
      [permissionId, userId]
    );
    return (result.changes ?? 0) > 0;
  }

  /**
   * Fetch a single permission by ID.
   */
  static async getPermission(userId: string, permissionId: string): Promise<Permission | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM permissions WHERE id = ? AND user_id = ?', [permissionId, userId]);
    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * List permissions for a user.
   */
  static async listPermissions(
    userId: string,
    filter?: { tool?: string; status?: string }
  ): Promise<Permission[]> {
    const db = await getDb();
    let query = 'SELECT * FROM permissions WHERE user_id = ?';
    const params: any[] = [userId];

    if (filter?.tool) {
      query += ' AND tool = ?';
      params.push(filter.tool);
    }
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    } else {
      query += " AND status = 'ACTIVE'";
    }

    query += ' ORDER BY created_at DESC';
    const rows = await db.all(query, params);
    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Check whether a tool capability execution is authorized.
   * Enforces Section 10: "No high-impact action proceeds without authorization."
   */
  static async checkPermission(
    userId: string,
    tool: string,
    capability: string,
    riskLevel: RiskLevel,
    _scope?: Record<string, any>
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiresApproval: boolean;
    permission?: Permission;
  }> {
    const db = await getDb();
    const now = new Date().toISOString();

    // Find active permission matching tool and capability (or wildcard '*')
    const rows = await db.all(
      `SELECT * FROM permissions 
       WHERE user_id = ? 
         AND (tool = ? OR tool = '*') 
         AND (capability = ? OR capability = '*')
         AND status = 'ACTIVE'
       ORDER BY created_at DESC`,
      [userId, tool, capability]
    );

    for (const row of rows) {
      // Check expiration
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        await db.run("UPDATE permissions SET status = 'EXPIRED' WHERE id = ?", [row.id]);
        continue;
      }

      const perm = this.mapRow(row);
      return {
        allowed: true,
        requiresApproval: false,
        permission: perm
      };
    }

    // No active grant found
    if (riskLevel === 'HIGH') {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `High-risk action [${tool}:${capability}] requires explicit user confirmation.`
      };
    }

    if (riskLevel === 'MEDIUM') {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Medium-risk action [${tool}:${capability}] requires user confirmation.`
      };
    }

    // LOW risk actions without explicit block are allowed by default for read/analysis/reversible org
    return {
      allowed: true,
      requiresApproval: false
    };
  }

  /**
   * Consume a one-time permission upon successful action completion.
   * Enforces Section 10: "A one-time approval never silently becomes permanent permission."
   */
  static async consumeOneTimePermission(userId: string, permissionId: string): Promise<void> {
    const db = await getDb();
    const perm = await this.getPermission(userId, permissionId);
    if (perm && perm.mode === 'ONE_TIME') {
      await db.run(
        "UPDATE permissions SET status = 'REVOKED' WHERE id = ? AND user_id = ?",
        [permissionId, userId]
      );
    }
  }

  private static mapRow(row: any): Permission {
    return {
      id: row.id,
      user_id: row.user_id,
      tool: row.tool,
      capability: row.capability,
      scope: row.scope ? JSON.parse(row.scope) : {},
      risk_level: row.risk_level as RiskLevel,
      mode: row.mode,
      conditions: row.conditions ? JSON.parse(row.conditions) : {},
      expires_at: row.expires_at,
      status: row.status,
      created_at: row.created_at
    };
  }
}
