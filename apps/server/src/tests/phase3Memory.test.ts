process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDb, closeDb } from '../db';
import { MemoryClassifierService } from '../services/memory/memoryClassifier';
import { MemoryPromotionPipeline } from '../services/memory/memoryPromotionPipeline';
import { MemoryLifecycleService } from '../services/memory/memoryLifecycleService';
import { MetaphorAdapter } from '../services/memory/metaphorAdapter';
import { ContextEngineService } from '../services/cognitive/contextEngine';
import { PersonalModelService } from '../services/personalModel/personalModelService';

describe('Orion Build Spec V1 — Phase 3 Memory & Classification Tests', () => {
  const userId = 'user_ben_phase3';
  let server: http.Server;
  let app: any;
  const testPort = 3009;
  const metaphor = new MetaphorAdapter();

  before(async () => {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, display_name, timezone, locale, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Ben (Phase 3 Test)', 'Europe/London', 'en-GB', '{}', now, now]
    );

    // Initialize clean state for user
    await PersonalModelService.updateCurrentState(userId, {
      current_focus: 'Orion Phase 3 Memory Verification',
      available_time_window: 60
    });

    // Dynamic import to honor NODE_ENV=test
    const indexModule = await import('../index');
    app = indexModule.default;

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(testPort, () => resolve());
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const db = await getDb();
    await db.run('DELETE FROM commitments WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM outcomes WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM goals WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM rules WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM preferences WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM decisions WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM patterns WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM knowledge WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM current_state WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await closeDb();
  });

  describe('1. Memory Classification Engine', () => {
    it('distinguishes TEMPORARY STATE from permanent operational data (no false permanence)', () => {
      const result = MemoryClassifierService.classify("I'm feeling really tired and exhausted today");
      assert.strictEqual(result.type, 'TEMPORARY_STATE');
      assert.strictEqual(result.persist, false, 'Temporary states must never be marked for persistent storage');
      assert.strictEqual(result.scope, 'SESSION');
      assert.ok(result.expiration, 'Temporary state must have an expiration window');
    });

    it('classifies explicit operating RULES with high priority', () => {
      const result = MemoryClassifierService.classify("Never deploy to production on Fridays under any circumstances");
      assert.strictEqual(result.type, 'RULE');
      assert.strictEqual(result.persist, true);
      assert.strictEqual(result.proposedEntity?.table, 'rules');
      assert.strictEqual(result.proposedEntity?.data.priority, 1);
    });

    it('classifies subjective PREFERENCES with confidence score', () => {
      const result = MemoryClassifierService.classify("I prefer bullet points over long paragraphs in answers");
      assert.strictEqual(result.type, 'PREFERENCE');
      assert.strictEqual(result.persist, true);
      assert.ok(result.confidence >= 0.85);
      assert.strictEqual(result.proposedEntity?.table, 'preferences');
    });

    it('classifies strategic DECISIONS with rationale extraction', () => {
      const result = MemoryClassifierService.classify("We decided to use SQLite locally because latency is critical");
      assert.strictEqual(result.type, 'DECISION');
      assert.strictEqual(result.persist, true);
      assert.strictEqual(result.proposedEntity?.table, 'decisions');
      assert.strictEqual(result.proposedEntity?.data.reason, 'latency is critical');
    });

    it('classifies COMMITMENTS and extracts due dates', () => {
      const result = MemoryClassifierService.classify("I promised John to deliver the investor deck by tomorrow");
      assert.strictEqual(result.type, 'COMMITMENT');
      assert.strictEqual(result.persist, true);
      assert.strictEqual(result.proposedEntity?.table, 'commitments');
      assert.ok(result.proposedEntity?.data.due_at, 'Due date must be extracted');
    });

    it('classifies recurring behavioral PATTERNS', () => {
      const result = MemoryClassifierService.classify("I notice that I always struggle with energy dips between 2 PM and 4 PM");
      assert.strictEqual(result.type, 'PATTERN');
      assert.strictEqual(result.persist, true);
      assert.strictEqual(result.proposedEntity?.table, 'patterns');
    });

    it('classifies strategic GOALS', () => {
      const result = MemoryClassifierService.classify("My goal is to reach $50k MRR by end of Q4");
      assert.strictEqual(result.type, 'GOAL');
      assert.strictEqual(result.persist, true);
      assert.strictEqual(result.proposedEntity?.table, 'goals');
      assert.strictEqual(result.proposedEntity?.data.horizon, 'Q4');
    });

    it('filters conversational filler as NOT_MEMORY', () => {
      const result = MemoryClassifierService.classify("thanks so much ok");
      assert.strictEqual(result.type, 'NOT_MEMORY');
      assert.strictEqual(result.persist, false);
    });
  });

  describe('2. Memory Promotion & Write-Back Pipeline', () => {
    it('refuses to write temporary states into operational tables', async () => {
      const promo = await MemoryPromotionPipeline.ingestAndPromote(
        userId,
        "I'm working from a coffee shop today"
      );
      assert.strictEqual(promo.promoted, false);
      assert.strictEqual(promo.type, 'TEMPORARY_STATE');
    });

    it('promotes explicit RULES into operational SQLite table', async () => {
      const promo = await MemoryPromotionPipeline.ingestAndPromote(
        userId,
        "Never schedule meetings before 10 AM. Protect morning deep work."
      );
      assert.strictEqual(promo.promoted, true);
      assert.strictEqual(promo.type, 'RULE');
      assert.strictEqual(promo.table, 'rules');
      assert.ok(promo.entityId);

      const rules = await PersonalModelService.getRules(userId);
      const found = rules.find(r => r.id === promo.entityId);
      assert.ok(found, 'Promoted rule must exist in database');
      assert.strictEqual(found.statement, 'Never schedule meetings before 10 AM. Protect morning deep work.');
    });

    it('promotes PREFERENCES into operational SQLite table', async () => {
      const promo = await MemoryPromotionPipeline.ingestAndPromote(
        userId,
        "I prefer dark mode interfaces across all tools"
      );
      assert.strictEqual(promo.promoted, true);
      assert.strictEqual(promo.type, 'PREFERENCE');
      assert.ok(promo.entityId);

      const prefs = await PersonalModelService.getPreferences(userId);
      const found = prefs.find(p => p.id === promo.entityId);
      assert.ok(found, 'Promoted preference must exist in database');
    });

    it('promotes COMMITMENTS into operational SQLite table', async () => {
      const promo = await MemoryPromotionPipeline.ingestAndPromote(
        userId,
        "I committed to send the monthly report to the board by tomorrow"
      );
      assert.strictEqual(promo.promoted, true);
      assert.strictEqual(promo.type, 'COMMITMENT');

      const comms = await PersonalModelService.getCommitments(userId);
      const found = comms.find(c => c.id === promo.entityId);
      assert.ok(found, 'Promoted commitment must exist in database');
    });
  });

  describe('3. Decision Lifecycle & Supersession Invariant', () => {
    it('supersedes previous decision when a new conflicting decision is promoted', async () => {
      // Step 1: Initial decision
      const initialPromo = await MemoryPromotionPipeline.ingestAndPromote(
        userId,
        "We decided to deploy Orion server on Render for simplicity"
      );
      assert.strictEqual(initialPromo.promoted, true);
      const oldDecisionId = initialPromo.entityId!;

      // Step 2: Superseding decision
      const newPromo = await MemoryPromotionPipeline.ingestAndPromote(
        userId,
        "We decided to deploy Orion server on AWS instead of Render because of compliance"
      );
      assert.strictEqual(newPromo.promoted, true);
      assert.strictEqual(newPromo.supersededId, oldDecisionId, 'Must identify and link supersedes_id');

      // Step 3: Verify database state
      const db = await getDb();
      const oldRow = await db.get('SELECT * FROM decisions WHERE id = ?', [oldDecisionId]);
      assert.strictEqual(oldRow.status, 'SUPERSEDED', 'Old decision must be marked SUPERSEDED');

      const newRow = await db.get('SELECT * FROM decisions WHERE id = ?', [newPromo.entityId]);
      assert.strictEqual(newRow.status, 'ACTIVE');
      assert.strictEqual(newRow.supersedes_id, oldDecisionId);
    });
  });

  describe('4. Forgetting & Context Protection (Section 7.10)', () => {
    it('completely purges forgotten entity from active ContextPack retrieval pathways', async () => {
      // 1. Promote a temporary rule
      const promo = await MemoryPromotionPipeline.ingestAndPromote(
        userId,
        "Always require manual confirmation for all file edits"
      );
      assert.strictEqual(promo.promoted, true);
      const ruleId = promo.entityId!;

      // Verify rule is present in context
      let pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Planning',
        request: 'Status'
      });
      assert.ok(pack.rules.some(r => r.id === ruleId), 'Rule should be in active ContextPack');

      // 2. User requests to forget this rule
      const forgotten = await MemoryLifecycleService.forget('rules', ruleId, userId);
      assert.strictEqual(forgotten, true);

      // 3. Verify rule NEVER appears in subsequent ContextPacks
      pack = await ContextEngineService.buildContextPack({
        userId,
        intent: 'Planning',
        request: 'Status'
      });
      assert.strictEqual(
        pack.rules.some(r => r.id === ruleId),
        false,
        'Forgotten rule must not leak into active ContextPack'
      );
    });
  });

  describe('5. Metaphor Adapter Deep Memory Integration', () => {
    it('stores, searches, retrieves, and forgets deep knowledge records', async () => {
      // 1. Store record in Metaphor / deep memory
      const memId = await metaphor.store({
        userId,
        text: 'Pseudonyms unified Supabase instance is sqthvliapkauoxieiwfb with pgvector',
        type: 'KNOWLEDGE',
        confidence: 0.98,
        metadata: { project: 'Pseudonyms' }
      });
      assert.ok(memId);

      // 2. Retrieve by ID
      const retrieved = await metaphor.retrieve(memId);
      assert.ok(retrieved);
      assert.ok(retrieved.text.includes('sqthvliapkauoxieiwfb'));

      // 3. Search by query keyword
      const searchResults = await metaphor.search({
        query: 'sqthvliapkauoxieiwfb',
        userId
      });
      assert.ok(searchResults.length > 0);
      assert.strictEqual(searchResults[0].id, memId);

      // 4. Forget
      await metaphor.forget(memId);
      const afterForget = await metaphor.retrieve(memId);
      assert.strictEqual(afterForget, null, 'Forgotten record must return null');
    });
  });

  describe('6. HTTP REST Endpoints (/api/memory)', () => {
    it('POST /api/memory/classify returns classified memory contract', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/memory/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "Never deploy to production on Fridays" })
      });

      const body = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.type, 'RULE');
      assert.strictEqual(body.data.persist, true);
    });

    it('POST /api/memory/promote promotes statement and returns record', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/memory/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          text: "I prefer high-contrast obsidian themes"
        })
      });

      const body = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.promoted, true);
      assert.strictEqual(body.data.type, 'PREFERENCE');
      assert.ok(body.data.entityId);
    });

    it('POST /api/memory/search searches deep memory', async () => {
      // Seed a fact first
      await metaphor.store({
        userId,
        text: 'Metaphor vector search uses ChromaDB locally',
        type: 'KNOWLEDGE',
        confidence: 1.0
      });

      const res = await fetch(`http://localhost:${testPort}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'ChromaDB' })
      });

      const body = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.some((m: any) => m.text.includes('ChromaDB')));
    });

    it('POST /api/memory/forget purges an entity', async () => {
      // Create a preference to forget
      const pref = await PersonalModelService.createPreference({
        user_id: userId,
        statement: 'Temporary preference to test forget endpoint'
      });

      const res = await fetch(`http://localhost:${testPort}/api/memory/forget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          table: 'preferences',
          id: pref.id
        })
      });

      const body = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.ok(body.message.includes('forgotten'));

      // Verify it is gone from database
      const prefs = await PersonalModelService.getPreferences(userId);
      assert.strictEqual(prefs.some(p => p.id === pref.id), false);
    });
  });
});
