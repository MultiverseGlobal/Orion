/**
 * Orion Build Spec V1 — Section 23: System Prompt Architecture
 *
 * Orion system prompts are composable and modular:
 * BASE ORION IDENTITY + USER MODEL + CURRENT CONTEXT + TASK CONTRACT + AVAILABLE TOOLS + AUTHORITY STATE
 */

import { ContextPack, User, CurrentState, RiskLevel } from '@orion/types';

export const BASE_ORION_IDENTITY = `You are Orion, a persistent personal intelligence system.

Your purpose is to help the user understand, decide, plan, and act across their life.

You are context-aware, outcome-oriented, willing to challenge the user, and careful about uncertainty.
You preserve user agency.

Do not confuse:
- facts with inferences,
- recommendations with decisions,
- preparation with execution,
- historical context with current truth.

Use tools deliberately.
Never claim an action succeeded unless verified.
Never invent unavailable context.`;

export const REASONING_CONTRACT = `Determine:
1. What is the user trying to accomplish?
2. What outcome matters?
3. What context is relevant?
4. What constraints exist?
5. What conflicts exist?
6. What options are meaningful?
7. What consequences matter?
8. What do you recommend?
9. What are you uncertain about?
10. What action, if any, should follow?

Separate facts from inferences and recommendations.
Challenge meaningful contradictions.
Do not hide uncertainty that could affect the decision.`;

export const PLANNING_CONTRACT = `Start from the desired outcome.
Assess current state.
Identify the gap.
Identify dependencies and blockers.
Determine the smallest meaningful next step.
Use the user's actual capacity and calendar.
Avoid unnecessary work.
Treat plans as revisable.
State important assumptions.`;

export const ORION_CAN_SAY_NO_INSTRUCTIONS = `When evaluating proposals or user questions, you MUST challenge:
- Explicit rule conflicts (e.g. working late if forbidden by user rule)
- Meaningful goal / action contradictions
- Foreseeable negative consequences
- Evidence-supported poor decisions
- Repeated avoidance
- Significant opportunity-cost mistakes

When challenging, use this tone and pattern:
"I don't recommend that."
"Here's why."
"You can override me."`;

export interface PromptCompositionOptions {
  user?: User | null;
  contextPack: ContextPack;
  taskType?: 'reasoning' | 'planning' | 'intervention' | 'general';
  availableTools?: Array<{ name: string; description: string; riskLevel: RiskLevel }>;
}

export function composeSystemPrompt(options: PromptCompositionOptions): string {
  const parts: string[] = [BASE_ORION_IDENTITY];

  // 1. User Model
  if (options.user) {
    parts.push(`USER PROFILE:
- Name: ${options.user.display_name}
- Timezone: ${options.user.timezone}
- Locale: ${options.user.locale || 'en-US'}`);
  }

  // 2. Active Personal Model Context
  const cp = options.contextPack;
  const contextSummary: string[] = ['ACTIVE PERSONAL MODEL CONTEXT:'];

  if (cp.currentState) {
    contextSummary.push(`- Current Focus: ${cp.currentState.current_focus || 'None'}`);
    contextSummary.push(`- Current Activity: ${cp.currentState.current_activity || 'None'}`);
    if (cp.currentState.available_time_window) {
      contextSummary.push(`- Available Time Window: ${cp.currentState.available_time_window} minutes`);
    }
    if (cp.currentState.active_constraints && cp.currentState.active_constraints.length > 0) {
      contextSummary.push(`- Active Constraints: ${cp.currentState.active_constraints.join(', ')}`);
    }
  }

  if (cp.rules && cp.rules.length > 0) {
    contextSummary.push(`ACTIVE RULES (Hard constraints):`);
    for (const r of cp.rules) {
      contextSummary.push(`  * [P${r.priority}] ${r.statement} (Scope: ${r.scope || 'GENERAL'})`);
    }
  }

  if (cp.goals && cp.goals.length > 0) {
    contextSummary.push(`ACTIVE GOALS:`);
    for (const g of cp.goals) {
      contextSummary.push(`  * ${g.title}${g.horizon ? ` [${g.horizon}]` : ''}: ${g.description || ''}`);
    }
  }

  if (cp.commitments && cp.commitments.length > 0) {
    contextSummary.push(`CURRENT COMMITMENTS:`);
    for (const c of cp.commitments) {
      contextSummary.push(`  * ${c.title}${c.due_at ? ` (Due: ${c.due_at})` : ''} - Consequence: ${c.consequence || 'unspecified'}`);
    }
  }

  if (cp.decisions && cp.decisions.length > 0) {
    contextSummary.push(`RECENT ACTIVE DECISIONS:`);
    for (const d of cp.decisions) {
      contextSummary.push(`  * ${d.statement} (Reason: ${d.reason || 'unspecified'})`);
    }
  }

  if (cp.conflicts && cp.conflicts.length > 0) {
    contextSummary.push(`DETECTED CONFLICTS:`);
    for (const cf of cp.conflicts) {
      contextSummary.push(`  ! ${cf}`);
    }
  }

  parts.push(contextSummary.join('\n'));

  // 3. Task Contract
  if (options.taskType === 'planning') {
    parts.push(`TASK CONTRACT: PLANNING\n${PLANNING_CONTRACT}`);
  } else {
    parts.push(`TASK CONTRACT: REASONING\n${REASONING_CONTRACT}\n\n${ORION_CAN_SAY_NO_INSTRUCTIONS}`);
  }

  // 4. Available Tools
  if (options.availableTools && options.availableTools.length > 0) {
    const toolLines = ['AVAILABLE TOOLS:'];
    for (const t of options.availableTools) {
      toolLines.push(`- ${t.name} (Risk: ${t.riskLevel}): ${t.description}`);
    }
    parts.push(toolLines.join('\n'));
  }

  return parts.join('\n\n---\n\n');
}
