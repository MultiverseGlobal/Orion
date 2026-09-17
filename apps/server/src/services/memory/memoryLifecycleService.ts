/**
 * Orion Build Spec V1 — Section 7.8, 7.9 & 7.10: Memory Lifecycle Service
 *
 * Implements:
 * - Supersession (ACTIVE -> SUPERSEDED -> ARCHIVED)
 * - Deactivation (status = INACTIVE)
 * - Archival (status = ARCHIVED)
 * - Forgetting (purged from active personal model and deep retrieval pathways)
 */

import { getDb } from '../../db';
import { MetaphorAdapter } from './metaphorAdapter';

export type LifecycleTable =
  | 'goals'
  | 'outcomes'
  | 'projects'
  | 'commitments'
  | 'rules'
  | 'preferences'
  | 'decisions'
  | 'patterns'
  | 'knowledge';

export class MemoryLifecycleService {
  private static metaphor = new MetaphorAdapter();

  /**
   * Deactivates an entity (status = 'INACTIVE').
   */
  static async deactivate(table: LifecycleTable, id: string, userId: string): Promise<boolean> {
    const db = await getDb();
    const now = new Date().toISOString();
    const res = await db.run(
      `UPDATE ${table} SET status = 'INACTIVE', updated_at = ? WHERE id = ? AND user_id = ?`,
      [now, id, userId]
    );
    return (res.changes ?? 0) > 0;
  }

  /**
   * Archives an entity (status = 'ARCHIVED').
   */
  static async archive(table: LifecycleTable, id: string, userId: string): Promise<boolean> {
    const db = await getDb();
    const now = new Date().toISOString();
    const res = await db.run(
      `UPDATE ${table} SET status = 'ARCHIVED', updated_at = ? WHERE id = ? AND user_id = ?`,
      [now, id, userId]
    );
    return (res.changes ?? 0) > 0;
  }

  /**
   * Supersedes an old entity with a new entity.
   */
  static async supersede(
    table: LifecycleTable,
    oldId: string,
    newId: string,
    userId: string
  ): Promise<boolean> {
    const db = await getDb();
    const res = await db.run(
      `UPDATE ${table} SET status = 'SUPERSEDED' WHERE id = ? AND user_id = ?`,
      [oldId, userId]
    );

    if (table === 'decisions') {
      await db.run(
        `UPDATE decisions SET supersedes_id = ? WHERE id = ? AND user_id = ?`,
        [oldId, newId, userId]
      );
    }

    return (res.changes ?? 0) > 0;
  }

  /**
   * Forgets an entity per Section 7.10.
   * Purges the record from active retrieval pathways so it never enters a ContextPack.
   */
  static async forget(table: LifecycleTable, id: string, userId: string): Promise<boolean> {
    const db = await getDb();

    // 1. If it's a knowledge entry, purge from deep memory adapter
    if (table === 'knowledge') {
      await this.metaphor.forget(id);
      const res = await db.run('DELETE FROM knowledge WHERE id = ? AND user_id = ?', [id, userId]);
      return (res.changes ?? 0) > 0;
    }

    // 2. Remove or mark FORGOTTEN in operational table
    // Removing completely guarantees it cannot leak into active context queries
    const res = await db.run(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
    return (res.changes ?? 0) > 0;
  }
}
