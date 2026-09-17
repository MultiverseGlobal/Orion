process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDb, closeDb } from '../db';
import { PersonalModelService } from '../services/personalModel/personalModelService';
import { ContextEngineService } from '../services/cognitive/contextEngine';
import { ReasoningService } from '../services/cognitive/reasoningEngine';
import { PlanningService } from '../services/cognitive/planningEngine';
import { OrionCoreService } from '../services/cognitive/orionCore';

describe('Orion Build Spec V1 — Phase 2 Cognitive Core Tests', () => {
  const userId = 'user_ben_phase2';
  let goalId: string;
  let outcomeId: string;
  let commitmentId: string;
  let ruleId: string;
  let server: http.Server;
  let app: any;
  const testPort = 3008;

  before(async () => {
    const db = await getDb();

    // 1. Seed dedicated test user
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, display_name, timezone, locale, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Ben (Phase 2 Test)', 'Europe/London', 'en-GB', '{}', now, now]
    );

    // 2. Seed Realistic Personal Model Fixture Data
    const goal = await PersonalModelService.createGoal({
      user_id: userId,
      title: 'Scale Pseudonyms Ecosystem',
      description: 'Achieve sustainable recurring revenue and robust autonomous systems.',
      domain: 'Business',
      horizon: 'Q4 2026',
      importance: 0.95,
      desired_state: '10 enterprise customers on Atlas and Orion deployed daily'
    });
    goalId = goal.id;

    const outcome = await PersonalModelService.createOutcome({
      user_id: userId,
      goal_id: goalId,
      title: 'Complete Phase 2 Cognitive Core',
      description: 'Implement Context Engine, Reasoning Core, and Outcome Planning',
      desired_result: 'Orion can reason contextually and answer "What should I do?"',
      current_state: 'Context Engine and Reasoning Services written',
      owner: 'SHARED',
      importance: 0.95
    });
    outcomeId = outcome.id;

    const twoDaysFromNow = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const commitment = await PersonalModelService.createCommitment({
      user_id: userId,
      title: 'Send Quarterly Investor Update',
      description: 'Comprehensive financial and roadmap progress report to stakeholders.',
      due_at: twoDaysFromNow,
      source: 'BOARD_REQUIREMENT',
      consequence: 'Erosion of stakeholder trust and governance delay',
      importance: 0.95,
      related_outcome_id: outcomeId
    });
    commitmentId = commitment.id;

    const rule = await PersonalModelService.createRule({
      user_id: userId,
      statement: 'No deep work after 9 PM. Cognitive recovery and sleep hygiene are non-negotiable.',
      scope: 'HEALTH_AND_RECOVERY',
      priority: 1,
      conditions: { maxHour: 21 }
    });
    ruleId = rule.id;

    await PersonalModelService.createPreference({
      user_id: userId,
      statement: 'Prefers direct, actionable conclusions with transparent trade-offs.',
      confidence: 0.95,
      source: 'USER_EXPLICIT'
    });

    await PersonalModelService.recordDecision({
      user_id: userId,
      statement: 'Prioritize Orion intelligence core over custom frontends.',
      reason: 'A beautiful shell without real reasoning cannot help govern life.',
      scope: 'ROADMAP'
    });

    await PersonalModelService.updateCurrentState(userId, {
      current_focus: 'Orion Cognitive Core Engine',
      current_activity: 'Verifying Phase 2 cognitive pipeline',
      active_outcome_id: outcomeId,
      available_time_window: 90,
      active_constraints: ['Deep focus mode', 'No external interruptions']
    });

    // Import app dynamically after setting NODE_ENV=test
    const indexModule = await import('../index');
    app = indexModule.default;

    // Start HTTP server for testing REST endpoints
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(testPort, () => resolve());
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const db = await getDb();
    // Clean up test data
    await db.run('DELETE FROM commitments WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM outcomes WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM goals WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM rules WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM preferences WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM decisions WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM current_state WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await closeDb();
  });

  describe('1. Intent Classification', () => {
    it('should classify planning intents accurately', () => {
      assert.strictEqual(ContextEngineService.classifyIntent('What should I do right now?'), 'Planning');
      assert.strictEqual(ContextEngineService.classifyIntent('How should I spend the next 2 hours?'), 'Planning');
      assert.strictEqual(ContextEngineService.classifyIntent('Help me plan tomorrow morning'), 'Planning');
    });

    it('should classify decision intents accurately', () => {
      assert.strictEqual(ContextEngineService.classifyIntent('Should I ship this tonight or wait for review?'), 'Decision');
      assert.strictEqual(ContextEngineService.classifyIntent('Help me decide between two approaches'), 'Decision');
    });

    it('should classify execution intents accurately', () => {
      assert.strictEqual(ContextEngineService.classifyIntent('Execute database migration script'), 'Execution');
      assert.strictEqual(ContextEngineService.classifyIntent('Send email to the founder'), 'Execution');
    });

    it('should classify explanation and reflection', () => {
      assert.strictEqual(ContextEngineService.classifyIntent('Explain why this constraint exists'), 'Explanation');
      assert.strictEqual(ContextEngineService.classifyIntent('How am I feeling about recent velocity?'), 'Reflection');
    });
  });

  describe('2. Context Engine & ContextPack Generation', () => {
    it('should assemble a complete, ranked ContextPack from Personal Model', async () => {
      const pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Planning',
        request: 'What should I do?'
      });

      assert.ok(pack, 'ContextPack should be defined');
      assert.strictEqual(pack.intent, 'Planning');
      assert.ok(pack.goals.length > 0, 'Should include active goals');
      assert.strictEqual(pack.goals[0].title, 'Scale Pseudonyms Ecosystem');

      assert.ok(pack.commitments.length > 0, 'Should include pending commitments');
      assert.strictEqual(pack.commitments[0].title, 'Send Quarterly Investor Update');

      assert.ok(pack.rules.length > 0, 'Should include active rules');
      assert.strictEqual(pack.rules[0].priority, 1);

      assert.strictEqual(pack.currentState.available_time_window, 90);
      assert.ok(pack.constraints?.some((c: string) => c.includes('90 minutes available')));
      assert.ok(pack.availableActions && pack.availableActions.length > 0);
    });

    it('should assess uncertainties properly', async () => {
      const pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Planning',
        request: 'What should I do?'
      });

      assert.ok(pack.uncertainties && pack.uncertainties.length > 0);
      const timeWindowUncertainty = pack.uncertainties.find((u: any) => u.subject === 'User available time window');
      assert.ok(timeWindowUncertainty);
      assert.strictEqual(timeWindowUncertainty.level, 'KNOWN');
    });
  });

  describe('3. Reasoning Engine — "What should I do?"', () => {
    it('should answer "What should I do?" with context-aware reasoning and clear recommendation', async () => {
      const pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Planning',
        request: 'What should I do?'
      });

      const result = await ReasoningService.reason({
        request: 'What should I do?',
        context: pack
      });

      assert.ok(result, 'ReasoningResult must be returned');
      assert.strictEqual(result.challenged, false, 'Standard planning request should not be challenged');
      assert.ok(result.recommendation, 'Structured recommendation must be present');
      assert.ok(result.recommendation.what.length > 0, 'Recommendation "what" must be non-empty');
      assert.ok(result.recommendation.why.length > 0, 'Recommendation "why" must be non-empty');
      assert.ok(result.recommendation.nextStep, 'Recommendation nextStep must exist');
      assert.ok(result.interpretation.length > 0, 'Interpretation narrative must be generated');

      // Check that proposed actions are generated
      assert.ok(result.proposedActions && result.proposedActions.length > 0);
      assert.strictEqual(result.proposedActions[0].actor, 'USER');
    });
  });

  describe('4. "Orion Can Say No" — Rule Violation Challenge', () => {
    it('should actively challenge requests that violate active rules (e.g. late night work)', async () => {
      const pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Execution',
        request: 'Let us do deep work tonight past 10 PM and code late'
      });

      const result = await ReasoningService.reason({
        request: 'Let us do deep work tonight past 10 PM and code late',
        context: pack
      });

      assert.strictEqual(result.challenged, true, 'Must challenge late night deep work request');
      assert.ok(result.challengeReason?.includes('Rule [P1]'), 'Must cite Rule P1 in challenge reason');
      assert.ok(result.interpretation.includes("I don't recommend that"), 'Must state "I don\'t recommend that"');
      assert.ok(result.interpretation.includes("Here's why"), 'Must state "Here\'s why"');
      assert.ok(result.interpretation.includes("You can override me"), 'Must state "You can override me"');
      assert.ok(result.recommendation?.alternative, 'Must offer a viable alternative');
    });

    it('should challenge escapism/avoidance when high-consequence commitment is imminent', async () => {
      const pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Conversation',
        request: 'I want to play games and browse twitter all afternoon'
      });

      const result = await ReasoningService.reason({
        request: 'I want to play games and browse twitter all afternoon',
        context: pack
      });

      assert.strictEqual(result.challenged, true, 'Must challenge avoidance when commitment is imminent');
      assert.ok(result.challengeReason?.includes('Send Quarterly Investor Update'));
    });
  });

  describe('5. Outcome Planning Engine', () => {
    it('should break an outcome into concrete milestones, gap rationale, and immediate next action', async () => {
      const pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Planning',
        request: 'Plan for outcome'
      });

      const targetOutcome = pack.outcomes.find((o: any) => o.id === outcomeId)!;
      assert.ok(targetOutcome, 'Target outcome must exist in context');

      const plan = PlanningService.generatePlan({
        outcome: targetOutcome,
        currentState: pack.currentState,
        context: pack
      });

      assert.ok(plan, 'Plan must be generated');
      assert.strictEqual(plan.outcomeId, outcomeId);
      assert.ok(plan.rationale.includes('Bridge gap'), 'Rationale must address gap');
      assert.ok(plan.milestones.length >= 2, 'Must have at least 2 milestones');
      assert.ok(plan.nextAction, 'Must specify an immediate next action');
      assert.ok(plan.schedule.length > 0, 'Must have schedule block');
      assert.strictEqual(plan.schedule[0].durationMinutes, 90, 'Schedule duration matches time window');
      assert.ok(plan.assumptions.length > 0, 'Must include assumptions');
      assert.ok(plan.reviewConditions.length > 0, 'Must include review conditions');
    });
  });

  describe('6. Orion Core Cognitive Pipeline', () => {
    it('should execute full end-to-end request pipeline for "What should I do?"', async () => {
      const response = await OrionCoreService.processRequest({
        userId,
        message: 'What should I do?'
      });

      assert.ok(response, 'OrionResponse must be defined');
      assert.strictEqual(response.intent, 'Planning');
      assert.ok(response.recommendation, 'Recommendation must be present');
      assert.ok(response.plan, 'Plan must be automatically generated for planning intent');
      assert.strictEqual(response.plan.outcomeId, outcomeId);
      assert.ok(response.contextRefs.length > 0, 'Context references must be tracked');
      assert.strictEqual(response.challenged, false);
    });

    it('should execute full end-to-end pipeline with rule challenge', async () => {
      const response = await OrionCoreService.processRequest({
        userId,
        message: 'I want to code late night past 9 pm'
      });

      assert.strictEqual(response.challenged, true);
      assert.ok(response.message.includes("I don't recommend that"));
      assert.strictEqual(response.plan, undefined, 'Challenged request should not produce a blind execution plan');
    });
  });

  describe('7. HTTP REST Integration Endpoints', () => {
    it('POST /api/cognitive/interact returns valid OrionResponse', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/cognitive/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: 'What should I do?'
        })
      });

      const body = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.intent, 'Planning');
      assert.ok(body.data.recommendation);
      assert.ok(body.data.plan);
      assert.ok(body.data.message);
    });

    it('POST /api/cognitive/context returns ContextPack', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/cognitive/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: 'What should I do?'
        })
      });

      const body = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.goals);
      assert.ok(body.data.commitments);
      assert.ok(body.data.rules);
    });

    it('POST /api/cognitive/plan returns Plan for an outcome', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/cognitive/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          outcomeId
        })
      });

      const body = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.outcomeId, outcomeId);
      assert.ok(body.data.milestones);
      assert.ok(body.data.nextAction);
    });
  });
});
