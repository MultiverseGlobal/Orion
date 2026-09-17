export const schemaSql = `-- ==============================================================================
-- ORION BUILD SPEC V1 — SQLITE SCHEMA (LOCAL-FIRST STATE ENGINE)
-- ==============================================================================

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT DEFAULT 'en-US',
  settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Goals
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_goal_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  horizon TEXT,
  importance REAL DEFAULT 0.5,
  desired_state TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  review_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_goal_id) REFERENCES goals(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);

-- 3. Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  current_objective TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status);

-- 4. Outcomes
CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_id TEXT,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  desired_result TEXT,
  current_state TEXT,
  owner TEXT NOT NULL DEFAULT 'USER',
  status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  importance REAL DEFAULT 0.5,
  deadline TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_outcomes_user_status ON outcomes(user_id, status);

-- 5. Commitments
CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT,
  due_at TEXT,
  source TEXT,
  consequence TEXT,
  importance REAL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'PENDING',
  related_outcome_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_outcome_id) REFERENCES outcomes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_commitments_user_due ON commitments(user_id, due_at);

-- 6. Rules
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  scope TEXT DEFAULT 'GENERAL',
  priority INTEGER NOT NULL DEFAULT 1,
  conditions TEXT DEFAULT '{}',
  exceptions TEXT DEFAULT '{}',
  source TEXT DEFAULT 'USER_EXPLICIT',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rules_user_status ON rules(user_id, status);

-- 7. Preferences
CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  scope TEXT DEFAULT 'GENERAL',
  confidence REAL NOT NULL DEFAULT 0.8,
  source TEXT DEFAULT 'USER_EXPLICIT',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_preferences_user_status ON preferences(user_id, status);

-- 8. Decisions
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  reason TEXT,
  scope TEXT DEFAULT 'GENERAL',
  evidence_refs TEXT DEFAULT '[]',
  alternatives TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_from TEXT,
  review_at TEXT,
  supersedes_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (supersedes_id) REFERENCES decisions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_user_status ON decisions(user_id, status);

-- 9. Patterns
CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence_refs TEXT DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.5,
  frequency REAL NOT NULL DEFAULT 1.0,
  confirmation_status TEXT NOT NULL DEFAULT 'UNCONFIRMED',
  first_observed_at TEXT,
  last_observed_at TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_patterns_user_status ON patterns(user_id, status);

-- 10. Current State
CREATE TABLE IF NOT EXISTS current_state (
  user_id TEXT PRIMARY KEY,
  current_activity TEXT,
  current_focus TEXT,
  active_outcome_id TEXT,
  available_time_window INTEGER,
  active_constraints TEXT DEFAULT '[]',
  recent_events TEXT DEFAULT '[]',
  last_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (active_outcome_id) REFERENCES outcomes(id) ON DELETE SET NULL
);

-- 11. Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  capability TEXT NOT NULL,
  scope TEXT DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  mode TEXT NOT NULL DEFAULT 'ONE_TIME',
  conditions TEXT DEFAULT '{}',
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_permissions_user_tool ON permissions(user_id, tool, capability);

-- 12. Actions
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  outcome_id TEXT,
  description TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'ORION',
  tool TEXT,
  capability TEXT,
  payload TEXT DEFAULT '{}',
  idempotency_key TEXT,
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  authorization TEXT,
  status TEXT NOT NULL DEFAULT 'PROPOSED',
  verification_result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (outcome_id) REFERENCES outcomes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_actions_user_status ON actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_actions_idempotency ON actions(user_id, idempotency_key);

-- 13. Action Steps
CREATE TABLE IF NOT EXISTS action_steps (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  description TEXT NOT NULL,
  tool TEXT,
  input_ref TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  result_ref TEXT,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_action_steps_action_id ON action_steps(action_id, sequence);

-- 14. Events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_event_id TEXT,
  type TEXT NOT NULL,
  payload_ref TEXT,
  occurred_at TEXT NOT NULL,
  processed_at TEXT,
  relevance REAL,
  status TEXT NOT NULL DEFAULT 'UNPROCESSED',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(source, source_event_id)
);
CREATE INDEX IF NOT EXISTS idx_events_user_status ON events(user_id, status);

-- 15. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  reason TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  dismissed_at TEXT,
  outcome TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_priority ON notifications(user_id, priority);

-- 16. Relationships
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship_type TEXT,
  context TEXT,
  importance REAL DEFAULT 0.5,
  last_interaction_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 17. Knowledge
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACQUIRED',
  content TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 18. Resources
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  capacity TEXT,
  constraints TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 19. Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_all_day INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  location TEXT,
  source TEXT DEFAULT 'LOCAL',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON calendar_events(user_id, start_time, end_time);
`;
