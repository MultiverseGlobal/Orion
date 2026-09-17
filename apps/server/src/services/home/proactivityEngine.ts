import type {
  ProactivityRule,
  ProactivityContext,
  ProactiveSpeechItem,
  Action,
  CalendarEvent
} from '@orion/types';

// ─── 1. Extensible Proactivity Engine ─────────────────────────────────────────

export class ProactivityEngine {
  private rules: ProactivityRule[] = [];

  registerRule(rule: ProactivityRule): void {
    this.rules.push(rule);
  }

  /**
   * Evaluate all registered rules against the current context.
   * Returns the first matching speech item, or null if nothing triggers.
   * Rules are evaluated in registration order; first match wins.
   */
  async evaluate(context: ProactivityContext): Promise<ProactiveSpeechItem | null> {
    for (const rule of this.rules) {
      try {
        const result = await rule.evaluate(context);
        if (result) return result;
      } catch (err) {
        console.error(`[ProactivityEngine] Rule "${rule.id}" threw:`, err);
      }
    }
    return null;
  }
}

// ─── 2. Initial Phase 6 Rules ─────────────────────────────────────────────────

/**
 * ImminentConflictRule: Detects calendar collisions occurring within 30 minutes.
 * Fires if two events overlap and the first one starts in <30 minutes.
 */
export const ImminentConflictRule: ProactivityRule = {
  id: 'imminent_conflict',
  async evaluate(context: ProactivityContext): Promise<ProactiveSpeechItem | null> {
    const now = context.now.getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    const upcoming = context.calendarEvents.filter((e: CalendarEvent) => {
      const start = new Date(e.start_time).getTime();
      return start > now && start - now <= thirtyMinutes;
    });

    if (upcoming.length < 2) return null;

    // Check for overlapping pairs
    for (let i = 0; i < upcoming.length; i++) {
      for (let j = i + 1; j < upcoming.length; j++) {
        const a = upcoming[i];
        const b = upcoming[j];
        const aEnd = new Date(a.end_time).getTime();
        const bStart = new Date(b.start_time).getTime();
        const bEnd = new Date(b.end_time).getTime();
        const aStart = new Date(a.start_time).getTime();

        if (aStart < bEnd && bStart < aEnd) {
          return {
            text: `You have a scheduling conflict in the next 30 minutes: "${a.title}" overlaps with "${b.title}".`,
            reason: 'imminent_calendar_conflict',
            targetOrbState: 'speaking'
          };
        }
      }
    }

    return null;
  }
};

/**
 * StagedUrgentApprovalRule: Detects HIGH-risk actions staged (WAITING_APPROVAL)
 * within the last 5 minutes that haven't been addressed.
 */
export const StagedUrgentApprovalRule: ProactivityRule = {
  id: 'staged_urgent_approval',
  async evaluate(context: ProactivityContext): Promise<ProactiveSpeechItem | null> {
    const now = context.now.getTime();
    const fiveMinutes = 5 * 60 * 1000;

    const urgent = context.pendingActions.filter((action: Action) => {
      if (action.status !== 'WAITING_APPROVAL') return false;
      if (action.risk_level !== 'HIGH') return false;
      const staged = new Date(action.created_at).getTime();
      return now - staged <= fiveMinutes;
    });

    if (urgent.length === 0) return null;

    const first = urgent[0];
    return {
      text: `I need your approval for a high-risk action: ${first.description}.`,
      reason: 'staged_urgent_approval',
      targetOrbState: 'needs_you'
    };
  }
};

// ─── 3. Default Engine Instance ───────────────────────────────────────────────

export const proactivityEngine = new ProactivityEngine();
proactivityEngine.registerRule(ImminentConflictRule);
proactivityEngine.registerRule(StagedUrgentApprovalRule);
