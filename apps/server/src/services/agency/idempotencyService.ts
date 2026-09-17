import crypto from 'crypto';
import { getDb } from '../../db';
import type { Action } from '@orion/types';

export class IdempotencyService {
  /**
   * Generates a deterministic SHA-256 hash for an action.
   */
  static generateKey(tool: string, capability: string, payload: unknown): string {
    const serialized = this.canonicalSerialize({ tool, capability, payload });
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Check if an action with this idempotency key was already completed or is executing.
   * Enforces Section 10.5: "Before consequential actions, check whether the same action has already happened."
   */
  static async findDuplicate(userId: string, idempotencyKey: string): Promise<Action | null> {
    const db = await getDb();
    const row = await db.get(
      `SELECT * FROM actions 
       WHERE user_id = ? 
         AND idempotency_key = ? 
         AND status IN ('COMPLETED', 'EXECUTING')
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, idempotencyKey]
    );

    if (!row) return null;

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
      status: row.status,
      verification_result: row.verification_result ? JSON.parse(row.verification_result) : null,
      error: row.error,
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at
    };
  }

  /**
   * Canonical JSON serialization with sorted keys for deterministic hashing.
   */
  private static canonicalSerialize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return `[${obj.map((item) => this.canonicalSerialize(item)).join(',')}]`;
    }
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((key) => `${JSON.stringify(key)}:${this.canonicalSerialize(obj[key])}`);
    return `{${parts.join(',')}}`;
  }
}
