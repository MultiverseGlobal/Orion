/**
 * Orion Build Spec V1 — Section 5: Context Engine
 *
 * "Personal Model = what Orion knows about the user."
 * "Context = what Orion needs for the current situation."
 */

import {
  ContextPack,
  Intent,
  UncertaintyLevel,
  Goal,
  Outcome,
  Project,
  Commitment,
  Rule,
  Preference,
  Decision,
  Pattern,
  CurrentState,
  ContextRequest
} from '@orion/types';
import { PersonalModelService } from '../personalModel/personalModelService';

export class ContextEngineService {
  /**
   * Classify user intent from the message using keyword heuristics & semantic markers.
   */
  static classifyIntent(message: string): Intent {
    const text = message.toLowerCase().trim();

    if (text.includes('what should i do') || text.includes('what next') || text.includes('how should i spend') || text.includes('prioritise') || text.includes('plan')) {
      return 'Planning';
    }
    if (text.includes('should i') || text.includes('decide') || text.includes('choose between') || text.includes('or should i')) {
      return 'Decision';
    }
    if (text.includes('do this') || text.includes('send') || text.includes('execute') || text.includes('create') || text.includes('schedule') || text.includes('run')) {
      return 'Execution';
    }
    if (text.includes('explain') || text.includes('why') || text.includes('how does')) {
      return 'Explanation';
    }
    if (text.includes('reflect') || text.includes('how am i doing') || text.includes('journal') || text.includes('feel')) {
      return 'Reflection';
    }
    if (text.includes('search') || text.includes('find out') || text.includes('look up') || text.includes('research')) {
      return 'Research';
    }
    if (text.includes('status') || text.includes('overview') || text.includes('what is') || text.includes('where is')) {
      return 'Information';
    }
    return 'Conversation';
  }

  /**
   * Build a complete ContextPack for a given request.
   */
  static async buildContextPack(req: ContextRequest): Promise<ContextPack> {
    const userId = req.userId;
    const query = req.request.toLowerCase();
    const intent = req.intent;

    // 1. Fetch relevant Personal Model components
    const [
      allGoals,
      allOutcomes,
      allProjects,
      allCommitments,
      allRules,
      allPreferences,
      allDecisions,
      allPatterns,
      currentState
    ] = await Promise.all([
      PersonalModelService.getGoals(userId, 'ACTIVE'),
      PersonalModelService.getOutcomes(userId, 'IN_PROGRESS'),
      PersonalModelService.getProjects(userId, 'ACTIVE'),
      PersonalModelService.getCommitments(userId),
      PersonalModelService.getRules(userId, 'ACTIVE'),
      PersonalModelService.getPreferences(userId),
      PersonalModelService.getDecisions(userId, 'ACTIVE'),
      PersonalModelService.getPatterns(userId),
      PersonalModelService.getCurrentState(userId)
    ]);

    // Also get NOT_STARTED outcomes for planning
    const notStartedOutcomes = await PersonalModelService.getOutcomes(userId, 'NOT_STARTED');
    const activeOutcomes = [...allOutcomes, ...notStartedOutcomes];

    // Filter pending commitments
    const pendingCommitments = allCommitments.filter((c: Commitment) => c.status === 'PENDING');

    // 2. Rank and filter relevance based on intent and query
    const rankedRules = this.rankRules(allRules, query);
    const rankedGoals = this.rankGoals(allGoals, query);
    const rankedCommitments = this.rankCommitments(pendingCommitments, query);
    const rankedDecisions = this.rankDecisions(allDecisions, query);
    const rankedProjects = this.rankProjects(allProjects, query);
    const rankedOutcomes = this.rankOutcomes(activeOutcomes, query);

    // 3. Extract active constraints
    const constraints: string[] = [];
    if (currentState?.active_constraints) {
      constraints.push(...currentState.active_constraints);
    }
    if (currentState?.available_time_window) {
      constraints.push(`Time window: ${currentState.available_time_window} minutes available`);
    }

    // Add high-priority rule constraints
    for (const rule of rankedRules.slice(0, 3)) {
      constraints.push(`Rule constraint: ${rule.statement}`);
    }

    // 4. Detect conflicts (Rule violations, deadline clashes, capacity limits)
    const conflicts = this.detectConflicts(query, rankedRules, rankedCommitments, currentState);

    // 5. Assess uncertainties
    const uncertainties = this.assessUncertainties(currentState, rankedCommitments, query);

    // 6. Infer desired outcome from request or active outcome
    let desiredOutcome: string | undefined;
    if (currentState?.active_outcome_id) {
      const active = activeOutcomes.find(o => o.id === currentState.active_outcome_id);
      if (active) {
        desiredOutcome = active.desired_result || active.title;
      }
    }
    if (!desiredOutcome && rankedOutcomes.length > 0) {
      desiredOutcome = rankedOutcomes[0].desired_result || rankedOutcomes[0].title;
    }

    // 7. Available actions based on intent
    const availableActions = this.determineAvailableActions(intent, rankedOutcomes, rankedCommitments);

    return {
      intent,
      desiredOutcome,
      currentState: currentState || {},
      goals: rankedGoals,
      commitments: rankedCommitments,
      rules: rankedRules,
      decisions: rankedDecisions,
      projects: rankedProjects,
      outcomes: rankedOutcomes,
      conflicts,
      uncertainties,
      constraints,
      availableActions
    };
  }

  /**
   * Rank rules: higher priority first, matching keywords boosted.
   */
  private static rankRules(rules: Rule[], query: string): Rule[] {
    return [...rules].sort((a, b) => {
      const aMatch = query && a.statement.toLowerCase().includes(query) ? 10 : 0;
      const bMatch = query && b.statement.toLowerCase().includes(query) ? 10 : 0;
      const scoreA = (a.priority || 1) * 2 + aMatch;
      const scoreB = (b.priority || 1) * 2 + bMatch;
      return scoreB - scoreA;
    });
  }

  /**
   * Rank goals: importance first, matching query boosted.
   */
  private static rankGoals(goals: Goal[], query: string): Goal[] {
    return [...goals].sort((a, b) => {
      const aMatch = query && (a.title.toLowerCase().includes(query) || (a.description || '').toLowerCase().includes(query)) ? 5 : 0;
      const bMatch = query && (b.title.toLowerCase().includes(query) || (b.description || '').toLowerCase().includes(query)) ? 5 : 0;
      const scoreA = (a.importance ?? 0.5) * 10 + aMatch;
      const scoreB = (b.importance ?? 0.5) * 10 + bMatch;
      return scoreB - scoreA;
    });
  }

  /**
   * Rank commitments: nearest due date and highest importance first.
   */
  private static rankCommitments(commitments: Commitment[], query: string): Commitment[] {
    return [...commitments].sort((a, b) => {
      // Due date proximity
      const now = Date.now();
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Infinity;

      const aUrgency = aDue < now + 86400000 * 2 ? 10 : 0;
      const bUrgency = bDue < now + 86400000 * 2 ? 10 : 0;

      const scoreA = (a.importance ?? 0.5) * 5 + aUrgency;
      const scoreB = (b.importance ?? 0.5) * 5 + bUrgency;

      return scoreB - scoreA;
    });
  }

  /**
   * Rank decisions: recency.
   */
  private static rankDecisions(decisions: Decision[], _query: string): Decision[] {
    return [...decisions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  private static rankProjects(projects: Project[], _query: string): Project[] {
    return projects;
  }

  private static rankOutcomes(outcomes: Outcome[], query: string): Outcome[] {
    return [...outcomes].sort((a, b) => {
      const aMatch = query && a.title.toLowerCase().includes(query) ? 5 : 0;
      const bMatch = query && b.title.toLowerCase().includes(query) ? 5 : 0;
      const scoreA = (a.importance ?? 0.5) * 5 + (a.status === 'IN_PROGRESS' ? 3 : 0) + aMatch;
      const scoreB = (b.importance ?? 0.5) * 5 + (b.status === 'IN_PROGRESS' ? 3 : 0) + bMatch;
      return scoreB - scoreA;
    });
  }

  /**
   * Conflict Detection per Section 5.2 and 8.5 ("Orion can say no").
   */
  private static detectConflicts(
    query: string,
    rules: Rule[],
    commitments: Commitment[],
    currentState: CurrentState | null
  ): string[] {
    const conflicts: string[] = [];

    // 1. Rule conflicts with user request (e.g. working late, violating boundaries)
    for (const rule of rules) {
      const stmt = rule.statement.toLowerCase();
      // Example rule: "No deep work after 9 PM" or "no work on weekends"
      if (stmt.includes('no deep work after') || stmt.includes('no work after')) {
        const currentHour = new Date().getHours();
        if (query.includes('work') || query.includes('code') || query.includes('deep work')) {
          if (currentHour >= 21 || currentHour < 6) {
            conflicts.push(`Direct conflict with Rule [P${rule.priority}]: "${rule.statement}". Deep work requested during restricted hours.`);
          }
        }
      }
      if (stmt.includes('protect sunday') || stmt.includes('no work on sunday')) {
        const isSunday = new Date().getDay() === 0;
        if (isSunday && (query.includes('work') || query.includes('meeting'))) {
          conflicts.push(`Direct conflict with Rule [P${rule.priority}]: "${rule.statement}". Work requested on protected day.`);
        }
      }
    }

    // 2. Imminent overdue commitment conflict
    const now = Date.now();
    for (const c of commitments) {
      if (c.due_at) {
        const dueTime = new Date(c.due_at).getTime();
        if (dueTime < now) {
          conflicts.push(`Overdue commitment: "${c.title}" was due on ${c.due_at}. Consequence: ${c.consequence || 'unspecified'}.`);
        } else if (dueTime < now + 4 * 3600 * 1000) {
          // Due within 4 hours
          conflicts.push(`Imminent commitment: "${c.title}" is due soon (${c.due_at}). Must prioritize over exploratory tasks.`);
        }
      }
    }

    // 3. Time window capacity conflict
    if (currentState?.available_time_window && currentState.available_time_window < 30) {
      if (query.includes('start project') || query.includes('deep work') || query.includes('overhaul')) {
        conflicts.push(`Capacity conflict: Available time window is only ${currentState.available_time_window} mins, insufficient for deep overhaul.`);
      }
    }

    return conflicts;
  }

  /**
   * Uncertainty assessment per Section 5.6.
   */
  private static assessUncertainties(
    currentState: CurrentState | null,
    commitments: Commitment[],
    _query: string
  ): Array<{ subject: string; level: UncertaintyLevel; note: string }> {
    const uncertainties: Array<{ subject: string; level: UncertaintyLevel; note: string }> = [];

    if (!currentState?.available_time_window) {
      uncertainties.push({
        subject: 'User available time window',
        level: 'WEAK_INFERENCE',
        note: 'Available time window is not explicitly set; assuming standard 60-90m block.'
      });
    } else {
      uncertainties.push({
        subject: 'User available time window',
        level: 'KNOWN',
        note: `Explicitly confirmed at ${currentState.available_time_window} minutes.`
      });
    }

    const unestimatedCommitments = commitments.filter(c => !c.due_at);
    if (unestimatedCommitments.length > 0) {
      uncertainties.push({
        subject: 'Commitment deadlines',
        level: 'SUPPORTED_INFERENCE',
        note: `${unestimatedCommitments.length} commitment(s) lack formal due timestamps.`
      });
    }

    return uncertainties;
  }

  /**
   * Determine available actions for the current intent.
   */
  private static determineAvailableActions(
    intent: Intent,
    outcomes: Outcome[],
    commitments: Commitment[]
  ): string[] {
    const actions: string[] = [];

    switch (intent) {
      case 'Planning':
        actions.push('Generate prioritized execution plan');
        actions.push('Break active outcome into immediate milestones');
        actions.push('Align schedule with calendar capacity');
        break;
      case 'Decision':
        actions.push('Analyze trade-offs and downstream consequences');
        actions.push('Record deliberate decision with rationale');
        actions.push('Identify viable alternatives');
        break;
      case 'Execution':
        actions.push('Dispatch verified action via Action Manager');
        actions.push('Request authority for external side-effects');
        break;
      default:
        if (outcomes.length > 0) {
          actions.push(`Advance outcome: ${outcomes[0].title}`);
        }
        if (commitments.length > 0) {
          actions.push(`Fulfill commitment: ${commitments[0].title}`);
        }
        break;
    }

    return actions;
  }
}
