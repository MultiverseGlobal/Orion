/**
 * Orion Build Spec V1 — Orion Core Cognitive Pipeline
 *
 * Orchestrates:
 * PERCEIVE -> UNDERSTAND -> CONTEXTUALISE -> DETERMINE WHAT MATTERS
 * -> REASON -> CHALLENGE / RECOMMEND -> PLAN -> RESPONSE
 */

import {
  OrionRequest,
  OrionResponse,
  ContextPack,
  ReasoningResult,
  Plan
} from '@orion/types';
import { ContextEngineService } from './contextEngine';
import { ReasoningService } from './reasoningEngine';
import { PlanningService } from './planningEngine';

export class OrionCoreService {
  /**
   * Primary cognitive pipeline entrypoint.
   */
  static async processRequest(req: OrionRequest): Promise<OrionResponse> {
    const userId = req.userId || 'user_ben';
    const message = (req.message || 'What should I do?').trim();

    // 1. Classify Intent
    const intent = ContextEngineService.classifyIntent(message);

    // 2. Build ContextPack
    const contextPack: ContextPack = await ContextEngineService.buildContextPack({
      userId,
      intent,
      request: message
    });

    // 3. Reason over Context (evaluates trade-offs, constraints, and "Orion can say no")
    const reasoning: ReasoningResult = await ReasoningService.reason({
      request: message,
      context: contextPack
    });

    // 4. Generate Plan if appropriate (e.g. Planning intent, or "What should I do?", and not challenged)
    let plan: Plan | undefined;
    if (!reasoning.challenged && (intent === 'Planning' || message.toLowerCase().includes('what should i do'))) {
      // Pick active outcome or top ranked outcome
      const targetOutcome = contextPack.outcomes.find(o => o.status === 'IN_PROGRESS') || contextPack.outcomes[0];
      if (targetOutcome) {
        plan = PlanningService.generatePlan({
          outcome: targetOutcome,
          currentState: contextPack.currentState,
          context: contextPack
        });
      }
    }

    // 5. Gather Context References
    const contextRefs: string[] = [];
    if (contextPack.goals.length > 0) contextRefs.push(`goal:${contextPack.goals[0].id}`);
    if (contextPack.commitments.length > 0) contextRefs.push(`commitment:${contextPack.commitments[0].id}`);
    if (contextPack.rules.length > 0) contextRefs.push(`rule:${contextPack.rules[0].id}`);
    if (contextPack.outcomes.length > 0) contextRefs.push(`outcome:${contextPack.outcomes[0].id}`);

    // 6. Check if actions need user approval
    const actions = reasoning.proposedActions || [];
    const needsApproval = actions.some(a => a.requiresApproval || a.riskLevel === 'HIGH');

    // 7. Compose Final Response
    return {
      message: reasoning.interpretation,
      intent,
      contextRefs,
      recommendation: reasoning.recommendation,
      plan,
      actions,
      needsApproval,
      challenged: reasoning.challenged
    };
  }
}
