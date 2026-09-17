import { ActionStateMachine } from '../agency/actionStateMachine';
import { PersonalModelService } from '../personalModel/personalModelService';
import { calendarAdapter } from '../calendar/calendarAdapter';
import { toolRouter } from '../agency/toolRouter';
import { proactivityEngine } from './proactivityEngine';
import type {
  Action,
  HomeOrientation,
  OrionOrbState,
  PendingApprovalItem,
  ProactivityContext,
  ToolResult,
  VerificationResult
} from '@orion/types';

const DEFAULT_USER_ID = 'user_ben';

// ─── Home Service ─────────────────────────────────────────────────────────────

export class HomeService {
  /**
   * Assembles the full HomeOrientation for a user.
   * This is the single entry point the frontend polls to understand Orion's current state.
   */
  static async getOrientation(userId: string): Promise<HomeOrientation> {
    // 1. Fetch pending approval actions
    const waitingActions = await ActionStateMachine.listActions(userId, 'WAITING_APPROVAL');

    // 2. Project each Action → PendingApprovalItem (human-readable, no technical noise)
    const pendingApprovals: PendingApprovalItem[] = waitingActions.map((action) =>
      this.projectApprovalItem(action)
    );

    // 3. Fetch focus context
    let focusContext: HomeOrientation['focusContext'] = undefined;
    try {
      const currentState = await PersonalModelService.getCurrentState(userId);
      if (currentState) {
        focusContext = {
          currentActivity: currentState.current_activity || undefined,
          availableMinutes: currentState.available_time_window || undefined
        };
      }
    } catch {
      // Non-fatal: focus context is optional
    }

    // 4. Run proactivity engine
    let proactiveSpeech: HomeOrientation['proactiveSpeech'] = null;
    try {
      const calendarEvents = await calendarAdapter.getEvents(userId);
      let currentState = null;
      try {
        currentState = await PersonalModelService.getCurrentState(userId);
      } catch { /* non-fatal */ }

      const context: ProactivityContext = {
        userId,
        pendingActions: waitingActions,
        calendarEvents,
        currentState,
        now: new Date()
      };

      const speech = await proactivityEngine.evaluate(context);
      if (speech) {
        proactiveSpeech = {
          text: speech.text,
          reason: speech.reason
        };
      }
    } catch (err) {
      console.error('[HomeService] Proactivity evaluation error:', err);
    }

    // 5. Determine Orb state
    let orbState: OrionOrbState = 'breathing';
    if (pendingApprovals.length > 0 || proactiveSpeech) {
      orbState = 'needs_you';
    }

    return {
      orbState,
      pendingApprovals,
      proactiveSpeech,
      focusContext
    };
  }

  /**
   * Approve a pending action through the full verification pipeline.
   * Returns the action, execution result, and verification result.
   */
  static async approveAction(
    userId: string,
    actionId: string
  ): Promise<{ action: Action; result: ToolResult; verification: VerificationResult }> {
    return ActionStateMachine.approveAction(userId, actionId);
  }

  /**
   * Reject/cancel a pending action. Uses CANCELLED status (not FAILED).
   */
  static async rejectAction(
    userId: string,
    actionId: string,
    reason?: string
  ): Promise<Action> {
    return ActionStateMachine.rejectAction(userId, actionId, reason);
  }

  // ─── Private Projection Helpers ───────────────────────────────────────────

  /**
   * Projects a raw Action into a PendingApprovalItem suitable for the mobile
   * approval surface. Strips all technical noise (idempotency keys, UUIDs, raw JSON).
   */
  private static projectApprovalItem(action: Action): PendingApprovalItem {
    const tool = action.tool || 'unknown';
    const capability = action.capability || 'unknown';

    // Determine rollback support from tool capabilities
    let supportsRollback = false;
    if (action.tool && action.capability) {
      const cap = toolRouter.getCapability(action.tool, action.capability);
      if (cap) {
        supportsRollback = cap.reversible;
      }
    }

    // Build human-readable "what will change" from payload
    const payload = action.payload || {};
    const whatWillChange = this.buildWhatWillChange(capability, payload);

    // Map HIGH risk to CRITICAL for display when tool is irreversible and high risk
    let displayRisk: PendingApprovalItem['riskLevel'] = action.risk_level;
    if (action.risk_level === 'HIGH' && !supportsRollback) {
      displayRisk = 'CRITICAL';
    }

    return {
      id: action.id,
      tool,
      capability,
      what: action.description,
      why: this.inferWhy(action),
      whatWillChange,
      riskLevel: displayRisk,
      stagedAt: action.created_at,
      supportsRollback
    };
  }

  /**
   * Builds a human-readable change description from the tool payload.
   */
  private static buildWhatWillChange(
    capability: string,
    payload: Record<string, any>
  ): PendingApprovalItem['whatWillChange'] {
    if (capability === 'create_event') {
      return {
        target: payload.title || 'Calendar Event',
        from: null,
        to: `${payload.start_time || '?'} – ${payload.end_time || '?'}`
      };
    }
    if (capability === 'delete_event') {
      return {
        target: payload.title || `Event ${payload.id || ''}`,
        from: 'Exists in calendar',
        to: 'Removed'
      };
    }
    if (capability === 'create_outcome') {
      return {
        target: payload.title || 'Outcome',
        from: null,
        to: 'New outcome created'
      };
    }
    if (capability === 'create_rule') {
      return {
        target: payload.statement || 'Rule',
        from: null,
        to: 'New rule established'
      };
    }
    if (capability === 'send_email') {
      return {
        target: `Email to ${payload.to || '?'}`,
        from: null,
        to: `Subject: ${payload.subject || '(no subject)'}`
      };
    }

    // Generic fallback
    return {
      target: capability,
      from: null,
      to: JSON.stringify(payload).slice(0, 100)
    };
  }

  /**
   * Infer a human-readable reason for why this action was proposed.
   * In a full system this would pull from the reasoning trace;
   * for Phase 6 initial implementation, we use the action description context.
   */
  private static inferWhy(action: Action): string {
    if (action.authorization) {
      if (action.authorization.includes('EXPLICIT_USER_APPROVAL')) {
        return 'You requested this action.';
      }
    }
    if (action.outcome_id) {
      return `Supports outcome ${action.outcome_id}.`;
    }
    return 'Orion determined this action would be helpful based on your current context.';
  }
}
