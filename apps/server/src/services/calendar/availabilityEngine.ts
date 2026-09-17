import { calendarAdapter, CalendarAdapter } from './calendarAdapter';
import { PersonalModelService } from '../personalModel/personalModelService';
import type {
  AvailabilityOptions,
  AvailabilityResult,
  CalendarEvent,
  TimeWindow
} from '@orion/types';

export class AvailabilityEngine {
  private calendar: CalendarAdapter;

  constructor(calendar?: CalendarAdapter) {
    this.calendar = calendar || calendarAdapter;
  }

  /**
   * Calculate free/busy intervals, deep work windows, and rule violations for a given day.
   */
  async calculateAvailability(
    userId: string,
    targetDate: string,
    options?: AvailabilityOptions
  ): Promise<AvailabilityResult> {
    const dateStr = targetDate.includes('T') ? targetDate.split('T')[0] : targetDate;
    const startHour = options?.dayStartHour ?? 9;
    const endHour = options?.dayEndHour ?? 21;
    const deepWorkThreshold = options?.deepWorkThreshold ?? 90;
    const bufferMinutes = options?.bufferMinutes ?? 0;

    const dayStart = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T${String(endHour).padStart(2, '0')}:00:00.000Z`);

    const dayStartISO = dayStart.toISOString();
    const dayEndISO = dayEnd.toISOString();

    // 1. Fetch calendar events for user in the target window
    const events = await this.calendar.getEvents(userId, dayStartISO, dayEndISO);

    // 2. Fetch user rules to check for rule violations
    const rules = await PersonalModelService.getRules(userId, 'ACTIVE');
    const ruleViolations: Array<{ rule: string; event: string }> = [];

    // Parse potential rule constraints (e.g. "No work after 21:00", "No meetings after 18:00")
    for (const rule of rules) {
      const statement = rule.statement.toLowerCase();
      // Check for after-hours work / meetings rules
      const afterMatch = statement.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (afterMatch) {
        let cutoffHour = parseInt(afterMatch[1], 10);
        const meridiem = afterMatch[3]?.toLowerCase();
        if (meridiem === 'pm' && cutoffHour < 12) cutoffHour += 12;
        if (meridiem === 'am' && cutoffHour === 12) cutoffHour = 0;

        for (const ev of events) {
          const evEnd = new Date(ev.end_time);
          const evHours = evEnd.getUTCHours() + evEnd.getUTCMinutes() / 60;
          if (evHours > cutoffHour) {
            ruleViolations.push({
              rule: rule.statement,
              event: `${ev.title} (${ev.start_time} - ${ev.end_time})`
            });
          }
        }
      }
    }

    // 3. Normalize & clamp busy intervals within day bounds
    interface RawInterval {
      title: string;
      startMs: number;
      endMs: number;
    }

    const rawIntervals: RawInterval[] = [];
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();

    for (const ev of events) {
      const evStartMs = new Date(ev.start_time).getTime();
      const evEndMs = new Date(ev.end_time).getTime();

      const clampedStart = Math.max(evStartMs, dayStartMs);
      const clampedEnd = Math.min(evEndMs, dayEndMs);

      if (clampedEnd > clampedStart) {
        rawIntervals.push({
          title: ev.title,
          startMs: clampedStart,
          endMs: clampedEnd
        });
      }
    }

    // Sort by startMs ascending
    rawIntervals.sort((a, b) => a.startMs - b.startMs);

    // 4. Merge overlapping or contiguous busy intervals
    const mergedBusy: Array<{ title: string; startMs: number; endMs: number }> = [];
    for (const interval of rawIntervals) {
      if (mergedBusy.length === 0) {
        mergedBusy.push({ ...interval });
      } else {
        const last = mergedBusy[mergedBusy.length - 1];
        const effectiveEnd = last.endMs + bufferMinutes * 60000;
        if (interval.startMs <= effectiveEnd) {
          last.endMs = Math.max(last.endMs, interval.endMs);
          last.title = `${last.title} + ${interval.title}`;
        } else {
          mergedBusy.push({ ...interval });
        }
      }
    }

    const busyIntervals = mergedBusy.map((b) => ({
      title: b.title,
      start: new Date(b.startMs).toISOString(),
      end: new Date(b.endMs).toISOString(),
      durationMinutes: Math.round((b.endMs - b.startMs) / 60000)
    }));

    // 5. Invert busy intervals to find free windows
    const freeWindows: TimeWindow[] = [];
    let pointerMs = dayStartMs;

    for (const b of mergedBusy) {
      if (b.startMs > pointerMs) {
        const durationMinutes = Math.round((b.startMs - pointerMs) / 60000);
        if (durationMinutes > 0) {
          freeWindows.push({
            start: new Date(pointerMs).toISOString(),
            end: new Date(b.startMs).toISOString(),
            durationMinutes,
            isDeepWork: durationMinutes >= deepWorkThreshold
          });
        }
      }
      pointerMs = Math.max(pointerMs, b.endMs);
    }

    if (pointerMs < dayEndMs) {
      const durationMinutes = Math.round((dayEndMs - pointerMs) / 60000);
      if (durationMinutes > 0) {
        freeWindows.push({
          start: new Date(pointerMs).toISOString(),
          end: new Date(dayEndMs).toISOString(),
          durationMinutes,
          isDeepWork: durationMinutes >= deepWorkThreshold
        });
      }
    }

    // 6. Compute aggregate metrics
    const totalFreeMinutes = freeWindows.reduce((acc, w) => acc + w.durationMinutes, 0);
    const deepWorkMinutes = freeWindows
      .filter((w) => w.isDeepWork)
      .reduce((acc, w) => acc + w.durationMinutes, 0);

    // 7. Dynamic update of current_state.available_time_window
    try {
      await PersonalModelService.updateCurrentState(userId, {
        available_time_window: totalFreeMinutes
      });
    } catch {
      // Graceful fallback if user not yet created
    }

    return {
      date: dateStr,
      totalFreeMinutes,
      deepWorkMinutes,
      busyIntervals,
      freeWindows,
      ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined
    };
  }
}

export const availabilityEngine = new AvailabilityEngine();
