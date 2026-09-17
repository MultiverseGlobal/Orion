/**
 * Orion Build Spec V1 — Section 9: Planning Engine
 *
 * "Start from the desired outcome. Assess current state. Identify the gap.
 * Identify dependencies and blockers. Determine the smallest meaningful next step.
 * Use the user's actual capacity. Avoid fake precision and endless replanning."
 */

import {
  PlanningInput,
  Plan,
  Milestone,
  ProposedAction,
  ScheduleBlock,
  Dependency,
  Blocker,
  Assumption,
  ReviewCondition,
  Outcome
} from '@orion/types';
import { randomUUID } from 'crypto';
import { availabilityEngine } from '../calendar/availabilityEngine';
import { calendarAdapter } from '../calendar/calendarAdapter';

export class PlanningService {
  /**
   * Generates a concrete, hypothesis-driven Plan from an Outcome, Context, and optional Calendar.
   */
  static generatePlan(input: PlanningInput): Plan {
    const { outcome, currentState, context, calendar } = input;
    const timeWindow = currentState.available_time_window || 60;

    // 1. Identify the Gap between Current State and Desired Outcome
    const currentStatus = outcome.current_state || 'Initial state';
    const desiredTarget = outcome.desired_result || outcome.title;
    const rationale = `Bridge gap from "${currentStatus}" to "${desiredTarget}" within available focus window (${timeWindow}m).`;

    // 2. Derive Milestones (Smallest logical breakdown, not infinite task bloat)
    const milestones = this.deriveMilestones(outcome);

    // 3. Determine Immediate Next Action
    const nextMilestone = milestones.find(m => !m.completed) || milestones[0];
    const nextAction: ProposedAction = {
      id: randomUUID(),
      description: nextMilestone ? `Complete milestone: ${nextMilestone.title}` : `Initiate ${outcome.title}`,
      actor: outcome.owner === 'ORION' ? 'ORION' : 'USER',
      riskLevel: 'LOW',
      requiresApproval: false
    };

    // 4. Derive Schedule Blocks based on available calendar capacity
    const schedule: ScheduleBlock[] = [];
    const freeWindows = calendar?.availability?.freeWindows;

    if (freeWindows && freeWindows.length > 0) {
      // Slot into genuine calendar free window
      const matchingWindow = freeWindows.find(w => w.durationMinutes >= timeWindow) || freeWindows[0];
      const blockDuration = Math.min(timeWindow, matchingWindow.durationMinutes);
      const blockStart = new Date(matchingWindow.start);
      const blockEnd = new Date(blockStart.getTime() + blockDuration * 60 * 1000);

      schedule.push({
        id: randomUUID(),
        title: `Deep focus: ${nextAction.description}`,
        startTime: matchingWindow.start,
        endTime: blockEnd.toISOString(),
        durationMinutes: blockDuration
      });
    } else {
      // Fallback to relative schedule from now
      const now = new Date();
      const endTime = new Date(now.getTime() + timeWindow * 60 * 1000);
      schedule.push({
        id: randomUUID(),
        title: `Deep focus: ${nextAction.description}`,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: timeWindow
      });
    }

    // 5. Identify Dependencies and Blockers
    const dependencies: Dependency[] = [];
    const blockers: Blocker[] = [];
    const assumptions: Assumption[] = [];
    const reviewConditions: ReviewCondition[] = [];

    if (outcome.goal_id) {
      const goal = context.goals.find(g => g.id === outcome.goal_id);
      if (goal) {
        dependencies.push({
          id: randomUUID(),
          description: `Aligns with strategic goal: ${goal.title}`,
          dependsOn: goal.id,
          status: 'resolved'
        });
      }
    }

    if (context.conflicts && context.conflicts.length > 0) {
      for (const conflict of context.conflicts) {
        blockers.push({
          id: randomUUID(),
          description: conflict,
          severity: 'minor',
          mitigation: 'Resolve conflict before commencing deep block.'
        });
      }
    }

    // Check calendar capacity vs milestone requirements
    const estimatedEffortMinutes = milestones.filter(m => !m.completed).length * 45;
    const totalFreeMinutes = calendar?.availability?.totalFreeMinutes ?? timeWindow;

    if (calendar?.availability && estimatedEffortMinutes > totalFreeMinutes) {
      blockers.push({
        id: randomUUID(),
        description: `Capacity constraint: Planned milestones require ~${estimatedEffortMinutes}m, but only ${totalFreeMinutes}m free time is available before deadline.`,
        severity: 'critical',
        mitigation: 'Extend deadline, reduce scope, or clear conflicting calendar commitments.'
      });
      assumptions.push({
        id: randomUUID(),
        statement: 'Requires extending deadline or moving lower-priority commitments to accommodate effort.',
        impactIfFalse: 'Milestones will slip past target delivery.'
      });
    } else {
      assumptions.push({
        id: randomUUID(),
        statement: `User has uninterrupted focus for the allocated ${schedule[0]?.durationMinutes || timeWindow}m block.`,
        impactIfFalse: 'Next action carries over to the next schedule slot.'
      });
    }

    // 6. State Review Conditions
    reviewConditions.push({
      trigger: 'On completion of immediate next action',
      action: 'Update outcome current_state and re-evaluate next milestone.'
    });

    if (freeWindows && freeWindows.length > 0) {
      reviewConditions.push({
        trigger: 'If a meeting or event is booked during the planned focus block',
        action: 'Run PlanInvalidationService to detect collision and trigger replanning.'
      });
    } else {
      reviewConditions.push({
        trigger: 'If interrupted or time window cut short',
        action: 'Checkpoint progress into outcome notes.'
      });
    }

    return {
      outcomeId: outcome.id,
      rationale,
      milestones,
      nextAction,
      schedule,
      dependencies,
      blockers,
      assumptions,
      reviewConditions
    };
  }

  /**
   * Async schedule-aware plan generator that automatically fetches live availability and calendar context.
   */
  static async generateScheduleAwarePlan(
    userId: string,
    outcome: Outcome,
    targetDate?: string,
    options?: {
      currentState?: Partial<PlanningInput['currentState']>;
      context?: PlanningInput['context'];
    }
  ): Promise<Plan> {
    const dateStr = targetDate || new Date().toISOString().slice(0, 10);
    const availability = await availabilityEngine.calculateAvailability(userId, dateStr);
    const dayStartISO = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
    const dayEndISO = new Date(`${dateStr}T23:59:59.999Z`).toISOString();
    const events = await calendarAdapter.getEvents(userId, dayStartISO, dayEndISO);

    const input: PlanningInput = {
      outcome,
      currentState: {
        ...(options?.currentState || {}),
        available_time_window: availability.deepWorkMinutes > 0 ? availability.deepWorkMinutes : availability.totalFreeMinutes
      },
      context: options?.context || {
        intent: 'Planning',
        desiredOutcome: outcome.title,
        currentState: { user_id: userId, available_time_window: availability.totalFreeMinutes, active_constraints: [], recent_events: [], last_updated_at: '' },
        goals: [],
        outcomes: [outcome],
        projects: [],
        commitments: [],
        rules: [],
        decisions: [],
        conflicts: [],
        uncertainties: []
      },
      calendar: {
        events,
        availableWindowsMinutes: availability.freeWindows.map(w => w.durationMinutes),
        availability
      }
    };

    return this.generatePlan(input);
  }

  /**
   * Breaks an outcome into 2-4 concrete milestones to prevent task inflation.
   */
  private static deriveMilestones(outcome: Outcome): Milestone[] {
    const title = outcome.title;
    const desc = outcome.description || outcome.desired_result || '';

    // If description mentions steps or commas, break them down; otherwise generate standard milestone progression
    const milestones: Milestone[] = [
      {
        id: randomUUID(),
        title: `Scope and prepare requirements for "${title}"`,
        description: 'Verify inputs, baseline context, and edge constraints.',
        order: 1,
        completed: outcome.status === 'IN_PROGRESS' || outcome.status === 'COMPLETED'
      },
      {
        id: randomUUID(),
        title: `Execute core implementation: "${title}"`,
        description: desc || 'Build the essential functioning deliverable.',
        order: 2,
        completed: outcome.status === 'COMPLETED'
      },
      {
        id: randomUUID(),
        title: `Verify and validate outcome against desired result`,
        description: outcome.desired_result || 'Confirm deliverable meets criteria.',
        order: 3,
        completed: outcome.status === 'COMPLETED'
      }
    ];

    return milestones;
  }
}
