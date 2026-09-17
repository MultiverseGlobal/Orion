import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  const dbPath = path.resolve(__dirname, '../../orion.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Initialize core schemas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS portrait (
      id TEXT PRIMARY KEY,
      name TEXT,
      identity TEXT,
      "values" TEXT,
      principles TEXT,
      strengths TEXT,
      blind_spots TEXT,
      dreams TEXT,
      relationships TEXT,
      decision_patterns TEXT, -- JSON array
      growth TEXT,            -- JSON array
      cognitive_profile TEXT, -- JSON object
      active_beliefs TEXT     -- JSON array
    );
  `);

  // Self-healing migrations for existing database files
  const portraitColumns = [
    'cognitive_profile TEXT',
    'active_beliefs TEXT',
    'emotional_trends TEXT',
    'behavioral_patterns TEXT',
    'identity_evolution TEXT',
  ];
  for (const col of portraitColumns) {
    try { await db.exec(`ALTER TABLE portrait ADD COLUMN ${col};`); } catch (_) {}
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY,
      category TEXT,
      icon TEXT,
      title TEXT,
      currentState TEXT,
      vision TEXT,
      milestones TEXT,        -- JSON array
      memories TEXT,          -- JSON array
      lessons TEXT,           -- JSON array
      progress INTEGER,
      timeline TEXT           -- JSON array of { date, text }
    );

    CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      type TEXT,
      title TEXT,
      author TEXT,
      content TEXT,
      dateAdded TEXT,
      tags TEXT               -- JSON array
    );

    CREATE TABLE IF NOT EXISTS chronicle (
      id TEXT PRIMARY KEY,
      time TEXT,
      category TEXT,
      text TEXT
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      sender TEXT,
      text TEXT,
      time TEXT,
      session TEXT
    );

    -- Knowledge Graph
    CREATE TABLE IF NOT EXISTS memory_nodes (
      id TEXT PRIMARY KEY,
      type TEXT,              -- MemoryNodeType
      label TEXT,
      description TEXT,
      confidence REAL DEFAULT 1.0,
      last_updated TEXT,
      metadata TEXT           -- JSON object
    );

    CREATE TABLE IF NOT EXISTS memory_edges (
      id TEXT PRIMARY KEY,
      from_id TEXT,
      to_id TEXT,
      relation TEXT,          -- MemoryRelation
      strength REAL DEFAULT 1.0,
      created_at TEXT
    );

    -- Proactive System
    CREATE TABLE IF NOT EXISTS proactive_signals (
      id TEXT PRIMARY KEY,
      type TEXT,              -- ProactiveSignalType
      trigger_time TEXT,
      message TEXT,
      acknowledged INTEGER DEFAULT 0,
      created_at TEXT
    );

    -- Action Layer
    CREATE TABLE IF NOT EXISTS action_log (
      id TEXT PRIMARY KEY,
      action_type TEXT,       -- ActionType
      payload TEXT,           -- JSON
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      executed_at TEXT,
      error TEXT
    );
  `);

  // Self-healing columns for actions table (run before schema migrations to ensure columns exist for indexes)
  const actionColumns = [
    'capability TEXT',
    "payload TEXT DEFAULT '{}'",
    'idempotency_key TEXT',
    'verification_result TEXT',
    'error TEXT'
  ];
  for (const col of actionColumns) {
    try { await db.exec(`ALTER TABLE actions ADD COLUMN ${col};`); } catch (_) {}
  }

  await runOrionMigrations(db);

  try { await db.exec(`CREATE INDEX IF NOT EXISTS idx_actions_idempotency ON actions(user_id, idempotency_key);`); } catch (_) {}

  await seedInitialData(db);
  await ensureDefaultUser(db);

  return db;
}

export const getDb = getDatabase;

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

import { schemaSql } from './db/schema.sqlite';

async function runOrionMigrations(database: Database): Promise<void> {
  await database.exec(schemaSql);
}

async function ensureDefaultUser(database: Database): Promise<void> {
  const defaultUserId = 'user_ben';
  const existing = await database.get('SELECT id FROM users WHERE id = ?', [defaultUserId]);
  if (!existing) {
    const now = new Date().toISOString();
    await database.run(
      `INSERT INTO users (id, display_name, timezone, locale, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        defaultUserId,
        'Ben',
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        'en-US',
        JSON.stringify({ defaultOwner: 'USER', activeHorizon: '5_MONTHS' }),
        now,
        now
      ]
    );

    await database.run(
      `INSERT OR IGNORE INTO current_state (user_id, current_activity, current_focus, available_time_window, active_constraints, recent_events, last_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        defaultUserId,
        'Setting up Orion Foundation',
        'Orion Architecture & Phase 1 Execution',
        120,
        JSON.stringify(['Phase 1 Foundation Priority', 'Preserve User Agency']),
        JSON.stringify([]),
        now
      ]
    );
  }
}

async function seedInitialData(database: Database): Promise<void> {
  const portraitCount = await database.get<{ count: number }>('SELECT count(*) as count FROM portrait');
  if (!portraitCount || portraitCount.count === 0) {
    await database.run(`
      INSERT INTO portrait (
        id, name, identity, "values", principles, strengths, blind_spots, dreams, relationships,
        decision_patterns, growth, cognitive_profile, active_beliefs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      'user_1',
      'Orion',
      'Architect, systems builder, and creative technologist.',
      'Autonomy, deep focus, aesthetic excellence, continuous mastery.',
      'Build systems that scale leverage. Prioritize long-term clarity over short-term noise.',
      'System design, rapid execution, synthetic reasoning.',
      'Occasional over-engineering before simple verification.',
      'Craft a seamless, high-agency personal AI companion operating in real-time.',
      'Key collaborators, research team, family.',
      JSON.stringify(['Prefers top-down architectural mental models', 'Iterates through rapid prototype feedback']),
      JSON.stringify(['Transitioning from raw task execution to systemic delegation']),
      JSON.stringify({
        problemSolvingStyle: 'System-builder (architectural foundations over ad-hoc scripts)',
        temporalBias: 'High focus on 3-month strategic compounding',
        attentionSpan: '90-minute high-intensity deep work blocks',
        decisionHeuristics: 'Code-first empirical validation'
      }),
      JSON.stringify([
        { belief: 'Clarity of mind follows environment organization', strength: 0.92, category: 'cognition' },
        { belief: 'Small daily system refinements compound exponentially', strength: 0.95, category: 'habit' }
      ])
    );
  }

  const journeyCount = await database.get<{ count: number }>('SELECT count(*) as count FROM journeys');
  if (!journeyCount || journeyCount.count === 0) {
    await database.run(`
      INSERT INTO journeys (id, category, icon, title, currentState, vision, milestones, memories, lessons, progress, timeline)
      VALUES 
      (
        'j_mental_1', 'mental', 'Brain', 'Cognitive Architecture & Focus',
        'Designing seamless AI companion memory and focus state loops.',
        'Achieve effortless deep flow with zero cognitive friction.',
        '["Build Memory Graph", "Implement Focus Mode", "Sync Mobile & Web"]',
        '["First successful graph visualization", "Clean theme sync"]',
        '["Systems beat willpower every time."]',
        75,
        '[{"date":"2026-07-20","text":"Completed Observer Sync and Action Dispatcher."}]'
      ),
      (
        'j_health_1', 'health', 'Zap', 'High Energy & Recovery Cycles',
        'Maintaining 90-minute focus blocks with deliberate rest intervals.',
        'Sustained high cognitive output without burnout.',
        '["Track circadian energy peaks", "Automate evening shutdown"]',
        '["Discovered morning deep work sweet spot"]',
        '["Rest is an active performance multiplier."]',
        60,
        '[{"date":"2026-07-19","text":"Integrated circadian energy tracking."}]'
      ),
      (
        'j_career_1', 'career', 'Target', 'Orion Companion Platform',
        'Shipping v2 companion with full mobile/web parity and vector iconography.',
        'An indispensable, zero-latency companion operating across all personal devices.',
        '["Web dashboard polish", "Mobile app parity", "Database seeding"]',
        '["First mobile gesture prototype"]',
        '["Aesthetics and speed build trust."]',
        85,
        '[{"date":"2026-07-21","text":"Upgrading to Lucide vector icons and dark glass theme."}]'
      )
    `);
  }

  const libraryCount = await database.get<{ count: number }>('SELECT count(*) as count FROM library');
  if (!libraryCount || libraryCount.count === 0) {
    await database.run(`
      INSERT INTO library (id, type, title, author, content, dateAdded, tags)
      VALUES 
      (
        'l_1', 'lesson', 'Systems Over Motivation', 'Orion',
        'When routines break after periods of high stress, redesign your environment instead of relying on raw motivation.',
        '2026-07-20',
        '["Systems", "Focus", "Self-Actualization"]'
      ),
      (
        'l_2', 'idea', 'Companion Platform Vision', 'Orion',
        'A true AI companion does not wait for prompts; it observes patterns, anticipates bottlenecks, and keeps memory context clean.',
        '2026-07-21',
        '["AI Architecture", "Orion", "Philosophy"]'
      )
    `);
  }
}

