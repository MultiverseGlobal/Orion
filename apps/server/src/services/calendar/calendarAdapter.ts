import crypto from 'crypto';
import { getDb } from '../../db';
import type { CalendarEvent, CalendarProvider } from '@orion/types';

export class CalendarAdapter implements CalendarProvider {
  /**
   * Fetch calendar events for a user, optionally filtered by date range.
   * If startDate and endDate are provided, returns events that overlap with [startDate, endDate].
   */
  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
    const db = await getDb();
    let query = 'SELECT * FROM calendar_events WHERE user_id = ?';
    const params: any[] = [userId];

    if (startDate && endDate) {
      // Overlap: event starts before range end, and ends after range start
      query += ' AND start_time < ? AND end_time > ?';
      params.push(endDate, startDate);
    } else if (startDate) {
      query += ' AND end_time >= ?';
      params.push(startDate);
    } else if (endDate) {
      query += ' AND start_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY start_time ASC';
    const rows = await db.all(query, params);

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Fetch a single event by ID.
   */
  async getEventById(userId: string, id: string): Promise<CalendarEvent | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM calendar_events WHERE id = ? AND user_id = ?', [id, userId]);
    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * Create a new calendar event.
   */
  async createEvent(
    userId: string,
    event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'> & { id?: string; user_id?: string }
  ): Promise<CalendarEvent> {
    const db = await getDb();
    const id = event.id || `cal_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const isAllDay = event.is_all_day ? 1 : 0;
    const source = event.source || 'LOCAL';

    await db.run(
      `INSERT INTO calendar_events (id, user_id, title, start_time, end_time, is_all_day, description, location, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        event.title,
        event.start_time,
        event.end_time,
        isAllDay,
        event.description || null,
        event.location || null,
        source,
        now,
        now
      ]
    );

    return {
      id,
      user_id: userId,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      is_all_day: Boolean(isAllDay),
      description: event.description || undefined,
      location: event.location || undefined,
      source,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Update an existing calendar event.
   */
  async updateEvent(userId: string, id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const db = await getDb();
    const existing = await this.getEventById(userId, id);
    if (!existing) {
      throw new Error(`Calendar event not found: ${id}`);
    }

    const updates: string[] = [];
    const values: any[] = [];
    const now = new Date().toISOString();

    if (patch.title !== undefined) {
      updates.push('title = ?');
      values.push(patch.title);
    }
    if (patch.start_time !== undefined) {
      updates.push('start_time = ?');
      values.push(patch.start_time);
    }
    if (patch.end_time !== undefined) {
      updates.push('end_time = ?');
      values.push(patch.end_time);
    }
    if (patch.is_all_day !== undefined) {
      updates.push('is_all_day = ?');
      values.push(patch.is_all_day ? 1 : 0);
    }
    if (patch.description !== undefined) {
      updates.push('description = ?');
      values.push(patch.description);
    }
    if (patch.location !== undefined) {
      updates.push('location = ?');
      values.push(patch.location);
    }
    if (patch.source !== undefined) {
      updates.push('source = ?');
      values.push(patch.source);
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(id, userId);

    await db.run(
      `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    const updated = await this.getEventById(userId, id);
    if (!updated) {
      throw new Error(`Failed to retrieve updated calendar event: ${id}`);
    }
    return updated;
  }

  /**
   * Delete a calendar event.
   */
  async deleteEvent(userId: string, id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.run('DELETE FROM calendar_events WHERE id = ? AND user_id = ?', [id, userId]);
    return (result.changes ?? 0) > 0;
  }

  /**
   * Clear all calendar events for a user (useful for testing/resetting).
   */
  async clearEvents(userId: string): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM calendar_events WHERE user_id = ?', [userId]);
  }

  /**
   * Seed realistic calendar fixtures matching the Build Spec golden scenarios.
   * Default schedule for the base date:
   *  - 09:30 - 10:00: Team Standup & Daily Sync
   *  - 11:30 - 12:30: Product Strategy Review
   *  - 12:30 - 13:30: Lunch Break
   *  - [13:30 - 16:30: 180 min free window / deep work]
   *  - 16:30 - 17:30: Orion Architectural Alignment
   *  - 19:30 - 20:30: Dinner & Wind-down
   */
  async seedRealisticFixtures(userId: string, baseDate?: Date): Promise<CalendarEvent[]> {
    const base = baseDate ? new Date(baseDate) : new Date();
    // Use date string format YYYY-MM-DD in local time
    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    const datePrefix = `${year}-${month}-${day}`;

    const fixtures: Array<{
      title: string;
      start_time: string;
      end_time: string;
      description: string;
      location: string;
      source: 'LOCAL' | 'GOOGLE';
    }> = [
      {
        title: 'Team Standup & Daily Sync',
        start_time: `${datePrefix}T09:30:00.000Z`,
        end_time: `${datePrefix}T10:00:00.000Z`,
        description: 'Morning sync with core team on daily deliverables.',
        location: 'Google Meet',
        source: 'GOOGLE'
      },
      {
        title: 'Product Strategy Review',
        start_time: `${datePrefix}T11:30:00.000Z`,
        end_time: `${datePrefix}T12:30:00.000Z`,
        description: 'Review Q4 priorities, Orion roadmap, and UX direction.',
        location: 'Virtual Room A',
        source: 'GOOGLE'
      },
      {
        title: 'Lunch Break',
        start_time: `${datePrefix}T12:30:00.000Z`,
        end_time: `${datePrefix}T13:30:00.000Z`,
        description: 'Recovery & lunch.',
        location: 'Kitchen / Offline',
        source: 'LOCAL'
      },
      {
        title: 'Orion Architectural Alignment',
        start_time: `${datePrefix}T16:30:00.000Z`,
        end_time: `${datePrefix}T17:30:00.000Z`,
        description: 'Deep dive into memory persistence and schedule-aware planning.',
        location: 'Lab',
        source: 'LOCAL'
      },
      {
        title: 'Dinner & Wind-down',
        start_time: `${datePrefix}T19:30:00.000Z`,
        end_time: `${datePrefix}T20:30:00.000Z`,
        description: 'Evening recovery.',
        location: 'Home',
        source: 'LOCAL'
      }
    ];

    const createdEvents: CalendarEvent[] = [];
    for (const fixture of fixtures) {
      const created = await this.createEvent(userId, {
        ...fixture,
        is_all_day: false
      });
      createdEvents.push(created);
    }

    return createdEvents;
  }

  private mapRow(row: any): CalendarEvent {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      start_time: row.start_time,
      end_time: row.end_time,
      is_all_day: Boolean(row.is_all_day),
      description: row.description || undefined,
      location: row.location || undefined,
      source: row.source || 'LOCAL',
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const calendarAdapter = new CalendarAdapter();
