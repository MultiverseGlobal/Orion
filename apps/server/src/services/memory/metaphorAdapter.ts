/**
 * Orion Build Spec V1 — Section 12: Metaphor Adapter
 *
 * Implements the canonical MemoryProvider interface.
 * Coordinates between Metaphor deep context engine and local persistent storage.
 */

import {
  MemoryProvider,
  MemoryQuery,
  MemoryResult,
  MemoryRecord
} from '@orion/types';
import { getDb } from '../../db';
import crypto from 'crypto';

export class MetaphorAdapter implements MemoryProvider {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.METAPHOR_API_URL || 'http://localhost:8000';
    this.apiKey = process.env.METAPHOR_API_KEY || '';
  }

  /**
   * Search memory using semantic / keyword matching.
   */
  async search(query: MemoryQuery): Promise<MemoryResult[]> {
    const limit = query.limit || 10;

    // 1. Try Metaphor backend if configured
    if (this.apiKey) {
      try {
        const res = await fetch(`${this.apiUrl}/api/v1/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(query)
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.results)) {
            return data.results;
          }
        }
      } catch {
        // Fall back to local SQLite knowledge search
      }
    }

    // 2. Local SQLite Knowledge search fallback
    const db = await getDb();
    const q = `%${query.query.toLowerCase()}%`;
    const rows = await db.all(
      `SELECT id, topic, content, confidence, source, updated_at
       FROM knowledge
       WHERE (LOWER(topic) LIKE ? OR LOWER(content) LIKE ?)
       ORDER BY confidence DESC, updated_at DESC
       LIMIT ?`,
      [q, q, limit]
    );

    return rows.map((r: any) => ({
      id: r.id,
      text: `${r.topic}: ${r.content}`,
      type: 'KNOWLEDGE',
      confidence: r.confidence ?? 1.0,
      timestamp: r.updated_at,
      metadata: { source: r.source }
    }));
  }

  /**
   * Retrieve a specific memory record by ID.
   */
  async retrieve(id: string): Promise<MemoryResult | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM knowledge WHERE id = ?', [id]);
    if (!row) return null;

    return {
      id: row.id,
      text: `${row.topic}: ${row.content}`,
      type: 'KNOWLEDGE',
      confidence: row.confidence ?? 1.0,
      timestamp: row.updated_at,
      metadata: { source: row.source }
    };
  }

  /**
   * Store a memory record in deep memory.
   */
  async store(memory: MemoryRecord): Promise<string> {
    const db = await getDb();
    const id = memory.id || `mem_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO knowledge (id, user_id, topic, status, content, confidence, source, updated_at)
       VALUES (?, ?, ?, 'ACQUIRED', ?, ?, ?, ?)`,
      [
        id,
        memory.userId,
        memory.type,
        memory.text,
        memory.confidence ?? 1.0,
        memory.metadata?.source || 'METAPHOR',
        now
      ]
    );

    // If Metaphor API is live, optionally broadcast
    if (this.apiKey) {
      try {
        await fetch(`${this.apiUrl}/api/v1/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({ ...memory, id })
        });
      } catch {
        // Non-blocking
      }
    }

    return id;
  }

  /**
   * Update a memory record.
   */
  async update(id: string, patch: Record<string, any>): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    if (patch.content) {
      await db.run('UPDATE knowledge SET content = ?, updated_at = ? WHERE id = ?', [patch.content, now, id]);
    }
  }

  /**
   * Forget a memory record (removes from active retrieval pathways).
   */
  async forget(id: string): Promise<void> {
    const db = await getDb();
    // Mark UNVERIFIED or delete to remove from search
    await db.run('DELETE FROM knowledge WHERE id = ?', [id]);
  }
}
