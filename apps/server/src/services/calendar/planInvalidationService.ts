import type {
  CalendarEvent,
  Plan,
  PlanValidationResult,
  ScheduleBlock
} from '@orion/types';

export interface PlanValidationOptions {
  deadline?: string;
  availableFreeMinutes?: number;
}

export class PlanInvalidationService {
  /**
   * Validate a plan against active calendar events, deadline constraints, and free capacity.
   *
   * Checks:
   * 1. Collision Check: Overlap between any ScheduleBlock and CalendarEvent.
   * 2. Deadline Jeopardy: Schedule blocks or milestones that exceed the outcome deadline.
   * 3. Capacity Deficit: Total required duration exceeding available free window capacity.
   */
  validatePlanAgainstCalendar(
    plan: Plan,
    events: CalendarEvent[],
    options?: PlanValidationOptions
  ): PlanValidationResult {
    // 1. Collision Check
    const conflictingEvents: CalendarEvent[] = [];
    const affectedScheduleBlocks: ScheduleBlock[] = [];
    const seenEventIds = new Set<string>();
    const seenBlockIds = new Set<string>();

    for (const block of plan.schedule || []) {
      const blockStartMs = new Date(block.startTime).getTime();
      const blockEndMs = new Date(block.endTime).getTime();

      for (const ev of events) {
        const evStartMs = new Date(ev.start_time).getTime();
        const evEndMs = new Date(ev.end_time).getTime();

        // Check interval overlap: (evStart < blockEnd && evEnd > blockStart)
        if (evStartMs < blockEndMs && evEndMs > blockStartMs) {
          if (!seenEventIds.has(ev.id)) {
            seenEventIds.add(ev.id);
            conflictingEvents.push(ev);
          }
          if (!seenBlockIds.has(block.id)) {
            seenBlockIds.add(block.id);
            affectedScheduleBlocks.push(block);
          }
        }
      }
    }

    if (conflictingEvents.length > 0) {
      const primaryBlock = affectedScheduleBlocks[0];
      const primaryEvent = conflictingEvents[0];
      return {
        valid: false,
        status: 'COLLISION',
        reason: `Schedule block "${primaryBlock.title}" overlaps with calendar event "${primaryEvent.title}" (${primaryEvent.start_time} - ${primaryEvent.end_time})`,
        conflictingEvents,
        affectedScheduleBlocks,
        recommendedAction: 'REPLAN'
      };
    }

    // 2. Deadline Jeopardy Check
    if (options?.deadline) {
      const deadlineMs = new Date(options.deadline).getTime();

      for (const block of plan.schedule || []) {
        const blockEndMs = new Date(block.endTime).getTime();
        if (blockEndMs > deadlineMs) {
          return {
            valid: false,
            status: 'DEADLINE_JEOPARDY',
            reason: `Schedule block "${block.title}" finishes at ${block.endTime}, which exceeds deadline ${options.deadline}`,
            affectedScheduleBlocks: [block],
            recommendedAction: 'NOTIFY_USER'
          };
        }
      }

      for (const milestone of plan.milestones || []) {
        if (milestone.dueDate) {
          const dueMs = new Date(milestone.dueDate).getTime();
          if (dueMs > deadlineMs) {
            return {
              valid: false,
              status: 'DEADLINE_JEOPARDY',
              reason: `Milestone "${milestone.title}" is due at ${milestone.dueDate}, which exceeds deadline ${options.deadline}`,
              recommendedAction: 'NOTIFY_USER'
            };
          }
        }
      }
    }

    // 3. Capacity Deficit Check
    if (options?.availableFreeMinutes !== undefined) {
      const totalPlannedMinutes = (plan.schedule || []).reduce(
        (acc, b) => acc + (b.durationMinutes || 0),
        0
      );

      if (totalPlannedMinutes > options.availableFreeMinutes) {
        return {
          valid: false,
          status: 'CAPACITY_EXCEEDED',
          reason: `Plan requires ${totalPlannedMinutes} minutes, but only ${options.availableFreeMinutes} minutes are available before deadline`,
          recommendedAction: 'REPLAN'
        };
      }
    }

    return {
      valid: true,
      status: 'VALID',
      recommendedAction: 'NONE'
    };
  }
}

export const planInvalidationService = new PlanInvalidationService();
