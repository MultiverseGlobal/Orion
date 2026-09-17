import { getDb, closeDb } from '../db';
import { PersonalModelService } from '../services/personalModel/personalModelService';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 ORION PHASE 1 FOUNDATION — VERIFICATION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const userId = 'user_ben';
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Database & Table Verification
    console.log('[Test 1] Database & Schema Table Verification');
    const db = await getDb();
    const expectedTables = [
      'users',
      'goals',
      'outcomes',
      'projects',
      'commitments',
      'rules',
      'preferences',
      'decisions',
      'patterns',
      'current_state',
      'permissions',
      'actions',
      'action_steps',
      'events',
      'notifications',
      'relationships',
      'knowledge',
      'resources'
    ];

    const rows = await db.all<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table'");
    const existingTableNames = new Set(rows.map(r => r.name));

    for (const table of expectedTables) {
      assert(existingTableNames.has(table), `Table '${table}' exists in SQLite database`);
    }

    // 2. Default User & CurrentState
    console.log('\n[Test 2] Default User & CurrentState Initialization');
    const user = await PersonalModelService.getUser(userId);
    assert(user !== null && user.id === userId, `User '${userId}' initialized with display_name: ${user?.display_name}`);
    
    const state = await PersonalModelService.getCurrentState(userId);
    assert(state !== null && state.user_id === userId, `CurrentState exists for '${userId}' with focus: "${state?.current_focus}"`);

    // 3. Goal -> Project -> Outcome -> Commitment Chain
    console.log('\n[Test 3] Goal -> Project -> Outcome -> Commitment Relationship Chain');
    const goal = await PersonalModelService.createGoal({
      user_id: userId,
      title: 'Build Orion Personal Intelligence Engine',
      description: 'Create a context-aware personal intelligence and execution layer',
      domain: 'Systems & Life Governance',
      horizon: '5_MONTHS',
      importance: 0.95
    });
    assert(goal.id.startsWith('goal_') && goal.status === 'ACTIVE', `Goal created: ${goal.title}`);

    const project = await PersonalModelService.createProject({
      user_id: userId,
      name: 'Orion Core Development',
      description: 'Building cognitive core, memory, agency, and cross-system context',
      current_objective: 'Phase 1 Foundation Delivery'
    });
    assert(project.id.startsWith('proj_') && project.status === 'ACTIVE', `Project created: ${project.name}`);

    const outcome = await PersonalModelService.createOutcome({
      user_id: userId,
      goal_id: goal.id,
      project_id: project.id,
      title: 'Complete Phase 1 Foundation',
      desired_result: 'Type-safe domain models, hybrid DB migrations, and Personal Model CRUD service operational',
      owner: 'ORION',
      importance: 0.9
    });
    assert(outcome.id.startsWith('out_') && outcome.owner === 'ORION', `Outcome created: ${outcome.title} (owner: ${outcome.owner})`);

    const commitment = await PersonalModelService.createCommitment({
      user_id: userId,
      title: 'Deliver Phase 1 with Zero Fake Fallbacks',
      description: 'Prove real SQLite persistence and clean contract boundaries',
      importance: 0.9,
      consequence: 'Foundational architectural integrity compromised if skipped',
      related_outcome_id: outcome.id
    });
    assert(commitment.id.startsWith('comm_') && commitment.related_outcome_id === outcome.id, `Commitment linked to outcome: ${commitment.title}`);

    // 4. Rules & Preferences
    console.log('\n[Test 4] Principles, Rules & Preferences Verification');
    const rule = await PersonalModelService.createRule({
      user_id: userId,
      statement: 'Never claim an action succeeded without verification',
      scope: 'AGENCY_INVARIANT',
      priority: 1,
      conditions: { requiresVerification: true }
    });
    assert(rule.id.startsWith('rule_') && rule.priority === 1, `Rule created: "${rule.statement}"`);

    const pref = await PersonalModelService.createPreference({
      user_id: userId,
      statement: 'Use Hybrid SQLite local persistence with Supabase cloud sync',
      confidence: 0.95,
      source: 'USER_EXPLICIT'
    });
    assert(pref.id.startsWith('pref_') && pref.confidence === 0.95, `Preference created: "${pref.statement}"`);

    // 5. Decision Supersession (Core Invariant)
    console.log('\n[Test 5] Decision Lifecycle & Supersession Invariant');
    const decision1 = await PersonalModelService.recordDecision({
      user_id: userId,
      statement: 'Initial storage strategy: Local SQLite only',
      reason: 'Fastest path to local execution',
      scope: 'PERSISTENCE'
    });
    assert(decision1.status === 'ACTIVE', `Decision 1 created as ACTIVE: "${decision1.statement}"`);

    // Supersede decision 1 with decision 2
    const decision2 = await PersonalModelService.recordDecision({
      user_id: userId,
      statement: 'Adopt Hybrid SQLite + Supabase cloud mirror',
      reason: 'Enables mobile Expo and web synchronization while preserving offline speed',
      scope: 'PERSISTENCE',
      supersedes_id: decision1.id
    });
    assert(decision2.status === 'ACTIVE', `Decision 2 created as ACTIVE: "${decision2.statement}"`);

    const supersededDec1 = (await PersonalModelService.getDecisions(userId, 'SUPERSEDED')).find(d => d.id === decision1.id);
    assert(supersededDec1 !== undefined && supersededDec1.status === 'SUPERSEDED', 'Decision 1 successfully transitioned to SUPERSEDED');

    // 6. Pattern Tracking (Inference vs Fact)
    console.log('\n[Test 6] Behavioral Pattern Tracking');
    const pattern = await PersonalModelService.recordPattern({
      user_id: userId,
      statement: 'Prefers explicit verification reports over speculative completion claims',
      confidence: 0.9,
      frequency: 3,
      confirmation_status: 'CONFIRMED'
    });
    assert(pattern.id.startsWith('pat_') && pattern.confirmation_status === 'CONFIRMED', `Pattern recorded: "${pattern.statement}"`);

    // 7. Personal Model Overview Snapshot
    console.log('\n[Test 7] Full Personal Model Overview Aggregation');
    const overview = await PersonalModelService.getOverview(userId);
    assert(overview.goals.length > 0, `Overview contains ${overview.goals.length} goals`);
    assert(overview.outcomes.length > 0, `Overview contains ${overview.outcomes.length} outcomes`);
    assert(overview.projects.length > 0, `Overview contains ${overview.projects.length} projects`);
    assert(overview.commitments.length > 0, `Overview contains ${overview.commitments.length} commitments`);
    assert(overview.rules.length > 0, `Overview contains ${overview.rules.length} rules`);
    assert(overview.preferences.length > 0, `Overview contains ${overview.preferences.length} preferences`);
    assert(overview.decisions.length > 0, `Overview contains ${overview.decisions.length} active decisions`);
    assert(overview.patterns.length > 0, `Overview contains ${overview.patterns.length} patterns`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════════\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite encountered an unhandled error:', err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

runTests();
