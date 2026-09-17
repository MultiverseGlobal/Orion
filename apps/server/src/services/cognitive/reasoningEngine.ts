/**
 * Orion Build Spec V1 — Section 8: Reasoning Engine
 *
 * "Orion carries the cognitive load of managing a complex life
 * without taking sovereignty over the person living it."
 */

import {
  ReasoningInput,
  ReasoningResult,
  Recommendation,
  Alternative,
  Consequence,
  Uncertainty,
  ProposedAction,
  ContextPack,
  Rule
} from '@orion/types';
import { BrainGateway } from '../brainGateway';
import { composeSystemPrompt } from './prompts';

export class ReasoningService {
  /**
   * Main entrypoint for reasoning over an input request and its ContextPack.
   */
  static async reason(input: ReasoningInput): Promise<ReasoningResult> {
    const { request, context } = input;
    const query = request.toLowerCase();

    // 1. Check for Rule Violations or Contradictions ("Orion can say no")
    const challenge = this.evaluateChallenge(query, context);

    // 2. Perform Decision Analysis (options, trade-offs, consequences)
    const decisionAnalysis = this.analyzeDecision(query, context);

    // 3. Formulate Structured Recommendation
    let recommendation: Recommendation | undefined;
    if (challenge.challenged) {
      recommendation = {
        what: challenge.recommendationWhat,
        why: challenge.challengeReason || 'Violates active constraints or principles.',
        evidence: challenge.evidence,
        consequences: challenge.consequences,
        tradeOffs: challenge.tradeOffs,
        alternative: challenge.alternative,
        nextStep: 'Acknowledge recommendation or override.',
        uncertainty: 'Certain (derived directly from explicit user rule).'
      };
    } else {
      recommendation = decisionAnalysis.recommendation;
    }

    // 4. Determine Proposed Actions
    const proposedActions = this.determineProposedActions(context, challenge.challenged, recommendation);

    // 5. Synthesize Narrative Interpretation (using BrainGateway if configured or deterministic synthesis)
    let interpretation = '';
    if (challenge.challenged) {
      interpretation = `I don't recommend that. Here's why: ${challenge.challengeReason}\n\nAlternative: ${challenge.alternative || 'Focus on active priority'}.\nYou can override me if you still wish to proceed.`;
    } else {
      interpretation = await this.synthesizeInterpretation(request, context, recommendation);
    }

    return {
      interpretation,
      recommendation,
      alternatives: decisionAnalysis.alternatives,
      consequences: decisionAnalysis.consequences,
      uncertainties: (context.uncertainties as Uncertainty[]) || [],
      evidenceRefs: decisionAnalysis.evidenceRefs,
      proposedActions,
      challenged: challenge.challenged,
      challengeReason: challenge.challengeReason
    };
  }

  /**
   * "Orion can say no" — Section 8.5
   * Evaluates if the request contradicts active rules, goals, or critical commitments.
   */
  private static evaluateChallenge(
    query: string,
    context: ContextPack
  ): {
    challenged: boolean;
    challengeReason?: string;
    recommendationWhat: string;
    evidence?: string[];
    consequences?: string[];
    tradeOffs?: string[];
    alternative?: string;
  } {
    // 1. Explicit Rule Violation Check
    for (const rule of context.rules) {
      const stmt = rule.statement.toLowerCase();

      // Time-based work restriction (e.g., "No deep work after 9 PM")
      if (stmt.includes('after 9 pm') || stmt.includes('past 9 pm') || stmt.includes('late night work')) {
        if (query.includes('work late') || query.includes('deep work tonight') || query.includes('pull an all-nighter') || query.includes('code late')) {
          return {
            challenged: true,
            challengeReason: `Direct conflict with Rule [P${rule.priority}]: "${rule.statement}". Late work degrades cognitive recovery and long-term momentum.`,
            recommendationWhat: 'Stop deep work and prepare for sleep/recovery.',
            evidence: [`Rule [P${rule.priority}]: ${rule.statement}`, 'Health & Cognitive Baseline priority'],
            consequences: ['Impaired focus and decision fatigue tomorrow', 'Breaks sleep consistency rule'],
            tradeOffs: ['Short-term code churn vs sustained next-day velocity'],
            alternative: 'Park open thoughts into a quick note and resume during peak morning window.'
          };
        }
      }
    }

    // 2. Procrastination / avoidance of imminent commitments
    if (query.includes('play games') || query.includes('watch youtube') || query.includes('browse twitter') || query.includes('scroll')) {
      const imminent = context.commitments.find(c => c.due_at && new Date(c.due_at).getTime() < Date.now() + 86400000 * 3);
      if (imminent) {
        return {
          challenged: true,
          challengeReason: `You have an imminent commitment: "${imminent.title}" due soon. Engaging in low-leverage avoidance right now carries high consequence (${imminent.consequence || 'broken commitment'}).`,
          recommendationWhat: `Focus 45 minutes on "${imminent.title}".`,
          evidence: [`Commitment: ${imminent.title} (Due: ${imminent.due_at})`],
          consequences: ['Missed deadline', 'Compromised stakeholder trust'],
          tradeOffs: ['Temporary escapism vs real relief from completed obligation'],
          alternative: 'Complete a single small chunk of the commitment before taking a deliberate recovery break.'
        };
      }
    }

    // 3. Direct conflicts from ContextPack
    if (context.conflicts && context.conflicts.length > 0) {
      const ruleConflict = context.conflicts.find(c => c.toLowerCase().includes('direct conflict'));
      if (ruleConflict) {
        return {
          challenged: true,
          challengeReason: ruleConflict,
          recommendationWhat: 'Respect active constraint and reschedule.',
          evidence: context.conflicts,
          alternative: 'Realign task with available permitted window.'
        };
      }
    }

    return {
      challenged: false,
      recommendationWhat: ''
    };
  }

  /**
   * Decision analysis per Section 8.3 & 8.4.
   */
  private static analyzeDecision(
    query: string,
    context: ContextPack
  ): {
    recommendation: Recommendation;
    alternatives: Alternative[];
    consequences: Consequence[];
    evidenceRefs: string[];
  } {
    const topGoal = context.goals[0];
    const topCommitment = context.commitments[0];
    const topOutcome = context.outcomes.find(o => o.status === 'IN_PROGRESS') || context.outcomes[0];
    const timeWindow = context.currentState?.available_time_window || 60;

    // What is the highest leverage item right now?
    let what = '';
    let why = '';
    const evidenceRefs: string[] = [];
    const consequences: Consequence[] = [];
    const alternatives: Alternative[] = [];

    if (topCommitment && topCommitment.due_at) {
      const dueTime = new Date(topCommitment.due_at).getTime();
      const isUrgent = dueTime < Date.now() + 86400000 * 2;

      if (isUrgent) {
        what = `Execute on commitment: "${topCommitment.title}"`;
        why = `It is due soon (${topCommitment.due_at}) and has consequence: "${topCommitment.consequence || 'unspecified'}". Fulfilling active commitments protects your integrity and credibility.`;
        evidenceRefs.push(`Commitment: ${topCommitment.id}`);
        consequences.push({
          description: `Fulfill commitment on time, avoiding: ${topCommitment.consequence || 'reputational drag'}`,
          severity: 'high',
          domain: 'Accountability',
          likelihood: 'certain'
        });
      }
    }

    if (!what && topOutcome) {
      what = `Advance outcome: "${topOutcome.title}"`;
      why = `This is your primary active outcome (${topOutcome.desired_result || 'key milestone'}). Advancing it moves you directly toward goal: "${topGoal ? topGoal.title : 'Active Vision'}".`;
      if (topGoal) evidenceRefs.push(`Goal: ${topGoal.id}`);
      evidenceRefs.push(`Outcome: ${topOutcome.id}`);
      consequences.push({
        description: 'Tangible progress toward strategic objective',
        severity: 'medium',
        domain: 'Progress',
        likelihood: 'likely'
      });
    }

    if (!what && topGoal) {
      what = `Clarify immediate next step for goal: "${topGoal.title}"`;
      why = `Goal "${topGoal.title}" is active with importance ${topGoal.importance || 0.8}, but lacks an active in-progress outcome.`;
      evidenceRefs.push(`Goal: ${topGoal.id}`);
    }

    if (!what) {
      what = 'Conduct a 15-minute review of goals and commitments to re-establish clarity.';
      why = 'No active outcomes or imminent commitments found in your model.';
    }

    // Viable alternatives
    if (topOutcome && topCommitment && topCommitment.title !== topOutcome.title) {
      alternatives.push({
        title: `Switch focus to "${topCommitment.title}"`,
        description: 'Prioritize deadline over strategic outcome',
        tradeOff: 'Protects external deadline but delays outcome milestone'
      });
    }

    alternatives.push({
      title: 'Rest & Cognitive Reset',
      description: 'Take a 20-minute restorative walk or break',
      tradeOff: 'Delays execution slightly, but boosts subsequent focus'
    });

    const recommendation: Recommendation = {
      what,
      why,
      evidence: evidenceRefs,
      consequences: consequences.map(c => c.description),
      tradeOffs: ['Focusing on this means deferring lower-priority backlog tasks.'],
      alternative: alternatives[0]?.title,
      nextStep: `Dedicate a focused ${Math.min(timeWindow, 45)}-minute block to this single objective.`,
      uncertainty: context.uncertainties?.[0]?.note || 'None'
    };

    return {
      recommendation,
      alternatives,
      consequences,
      evidenceRefs
    };
  }

  /**
   * Determine immediate proposed actions based on the recommendation.
   */
  private static determineProposedActions(
    context: ContextPack,
    challenged: boolean,
    recommendation?: Recommendation
  ): ProposedAction[] {
    const actions: ProposedAction[] = [];

    if (challenged) {
      actions.push({
        description: 'Acknowledge warning and stand down from late/conflicting work',
        actor: 'USER',
        riskLevel: 'LOW',
        requiresApproval: false
      });
      return actions;
    }

    if (recommendation) {
      actions.push({
        description: recommendation.what,
        actor: 'USER',
        riskLevel: 'LOW',
        requiresApproval: false
      });
      if (recommendation.nextStep) {
        actions.push({
          description: recommendation.nextStep,
          actor: 'USER',
          riskLevel: 'LOW',
          requiresApproval: false
        });
      }
    }

    return actions;
  }

  /**
   * Synthesize narrative response.
   * If LLM is available via BrainGateway, query it with composed prompt;
   * otherwise return concise, high-clarity structured summary.
   */
  private static async synthesizeInterpretation(
    request: string,
    context: ContextPack,
    recommendation: Recommendation
  ): Promise<string> {
    // If an API key is present, attempt LLM call
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY) {
      try {
        const systemPrompt = composeSystemPrompt({
          contextPack: context,
          taskType: 'reasoning'
        });

        const userPrompt = `User request: "${request}"

Structured recommendation:
- What: ${recommendation.what}
- Why: ${recommendation.why}
- Next step: ${recommendation.nextStep || 'Proceed with focus'}

Synthesize a concise, context-aware Orion response following the Orion tone: direct, respectful of user agency, outcome-focused, and grounded in active priorities.`;

        const brainResp = await BrainGateway.execute({
          systemPrompt,
          userPrompt,
          temperature: 0.2
        });

        if (brainResp && brainResp.text && brainResp.providerUsed !== 'fallback') {
          return brainResp.text.trim();
        }
      } catch (err) {
        // Fall back gracefully to deterministic synthesis
      }
    }

    // Deterministic synthesis per Orion spec
    const lines = [
      `Based on your active context, here is what matters right now:`,
      ``,
      `**Recommendation:** ${recommendation.what}`,
      `**Why:** ${recommendation.why}`,
      recommendation.nextStep ? `**Next Step:** ${recommendation.nextStep}` : '',
      recommendation.alternative ? `*(Alternative: ${recommendation.alternative})*` : ''
    ].filter(Boolean);

    return lines.join('\n');
  }
}
