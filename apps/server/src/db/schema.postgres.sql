-- ==============================================================================
-- ORION BUILD SPEC V1 — POSTGRESQL / SUPABASE CLOUD SCHEMA
-- Project Ref: sqthvliapkauoxieiwfb
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT DEFAULT 'en-US',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Goals
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  horizon TEXT,
  importance NUMERIC DEFAULT 0.5,
  desired_state TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON public.goals(user_id, status);

-- 3. Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  current_objective TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON public.projects(user_id, status);

-- 4. Outcomes
CREATE TABLE IF NOT EXISTS public.outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  desired_result TEXT,
  current_state TEXT,
  owner TEXT NOT NULL DEFAULT 'USER',
  status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  importance NUMERIC DEFAULT 0.5,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_user_status ON public.outcomes(user_id, status);

-- 5. Commitments
CREATE TABLE IF NOT EXISTS public.commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  source TEXT,
  consequence TEXT,
  importance NUMERIC DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'PENDING',
  related_outcome_id UUID REFERENCES public.outcomes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commitments_user_due ON public.commitments(user_id, due_at);

-- 6. Rules
CREATE TABLE IF NOT EXISTS public.rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  scope TEXT DEFAULT 'GENERAL',
  priority INTEGER NOT NULL DEFAULT 1,
  conditions JSONB DEFAULT '{}'::jsonb,
  exceptions JSONB DEFAULT '{}'::jsonb,
  source TEXT DEFAULT 'USER_EXPLICIT',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rules_user_status ON public.rules(user_id, status);

-- 7. Preferences
CREATE TABLE IF NOT EXISTS public.preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  scope TEXT DEFAULT 'GENERAL',
  confidence NUMERIC NOT NULL DEFAULT 0.8,
  source TEXT DEFAULT 'USER_EXPLICIT',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_preferences_user_status ON public.preferences(user_id, status);

-- 8. Decisions
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  reason TEXT,
  scope TEXT DEFAULT 'GENERAL',
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  alternatives JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_from TIMESTAMPTZ,
  review_at TIMESTAMPTZ,
  supersedes_id UUID REFERENCES public.decisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decisions_user_status ON public.decisions(user_id, status);

-- 9. Patterns
CREATE TABLE IF NOT EXISTS public.patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  frequency NUMERIC NOT NULL DEFAULT 1.0,
  confirmation_status TEXT NOT NULL DEFAULT 'UNCONFIRMED',
  first_observed_at TIMESTAMPTZ,
  last_observed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);
CREATE INDEX IF NOT EXISTS idx_patterns_user_status ON public.patterns(user_id, status);

-- 10. Current State
CREATE TABLE IF NOT EXISTS public.current_state (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_activity TEXT,
  current_focus TEXT,
  active_outcome_id UUID REFERENCES public.outcomes(id) ON DELETE SET NULL,
  available_time_window INTEGER,
  active_constraints JSONB DEFAULT '[]'::jsonb,
  recent_events JSONB DEFAULT '[]'::jsonb,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Permissions
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  capability TEXT NOT NULL,
  scope JSONB DEFAULT '{}'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  mode TEXT NOT NULL DEFAULT 'ONE_TIME',
  conditions JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_permissions_user_tool ON public.permissions(user_id, tool, capability);

-- 12. Actions
CREATE TABLE IF NOT EXISTS public.actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  outcome_id UUID REFERENCES public.outcomes(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'ORION',
  tool TEXT,
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  authorization TEXT,
  status TEXT NOT NULL DEFAULT 'PROPOSED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_actions_user_status ON public.actions(user_id, status);

-- 13. Action Steps
CREATE TABLE IF NOT EXISTS public.action_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  description TEXT NOT NULL,
  tool TEXT,
  input_ref TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  result_ref TEXT,
  verification_status TEXT DEFAULT 'UNVERIFIED'
);
CREATE INDEX IF NOT EXISTS idx_action_steps_action_id ON public.action_steps(action_id, sequence);

-- 14. Events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_event_id TEXT,
  type TEXT NOT NULL,
  payload_ref TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  relevance NUMERIC,
  status TEXT NOT NULL DEFAULT 'UNPROCESSED',
  UNIQUE(source, source_event_id)
);
CREATE INDEX IF NOT EXISTS idx_events_user_status ON public.events(user_id, status);

-- 15. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  reason TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  outcome TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_priority ON public.notifications(user_id, priority);

-- 16. Relationships
CREATE TABLE IF NOT EXISTS public.relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship_type TEXT,
  context TEXT,
  importance NUMERIC DEFAULT 0.5,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Knowledge
CREATE TABLE IF NOT EXISTS public.knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACQUIRED',
  content TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Resources
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  capacity TEXT,
  constraints JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
