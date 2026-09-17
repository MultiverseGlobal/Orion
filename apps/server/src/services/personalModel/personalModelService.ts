import crypto from 'crypto';
import { getDb } from '../../db';
import type {
  User,
  Goal,
  Outcome,
  Project,
  Commitment,
  Rule,
  Preference,
  Decision,
  Pattern,
  CurrentState,
  PersonalModelOverview,
  OutcomeOwner
} from '@orion/types';

export class PersonalModelService {
  // ─── 1. Users ─────────────────────────────────────────────────────────────
  static async getUser(userId: string): Promise<User | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!row) return null;
    return {
      ...row,
      settings: row.settings ? JSON.parse(row.settings) : {}
    };
  }

  // ─── 2. Goals ─────────────────────────────────────────────────────────────
  static async createGoal(goal: {
    user_id: string;
    parent_goal_id?: string | null;
    title: string;
    description?: string | null;
    domain?: string | null;
    horizon?: string | null;
    importance?: number;
    desired_state?: string | null;
    review_at?: string | null;
  }): Promise<Goal> {
    const db = await getDb();
    const id = `goal_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO goals (id, user_id, parent_goal_id, title, description, domain, horizon, importance, desired_state, status, review_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [
        id,
        goal.user_id,
        goal.parent_goal_id || null,
        goal.title,
        goal.description || null,
        goal.domain || null,
        goal.horizon || null,
        goal.importance ?? 0.5,
        goal.desired_state || null,
        goal.review_at || null,
        now,
        now
      ]
    );

    return {
      id,
      user_id: goal.user_id,
      parent_goal_id: goal.parent_goal_id || null,
      title: goal.title,
      description: goal.description || null,
      domain: goal.domain || null,
      horizon: goal.horizon || null,
      importance: goal.importance ?? 0.5,
      desired_state: goal.desired_state || null,
      status: 'ACTIVE',
      review_at: goal.review_at || null,
      created_at: now,
      updated_at: now
    };
  }

  static async getGoals(userId: string, status: string = 'ACTIVE'): Promise<Goal[]> {
    const db = await getDb();
    return db.all('SELECT * FROM goals WHERE user_id = ? AND status = ? ORDER BY importance DESC, created_at DESC', [userId, status]);
  }

  // ─── 3. Projects ──────────────────────────────────────────────────────────
  static async createProject(project: {
    user_id: string;
    name: string;
    description?: string | null;
    current_objective?: string | null;
  }): Promise<Project> {
    const db = await getDb();
    const id = `proj_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO projects (id, user_id, name, description, status, current_objective, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [
        id,
        project.user_id,
        project.name,
        project.description || null,
        project.current_objective || null,
        now,
        now
      ]
    );

    return {
      id,
      user_id: project.user_id,
      name: project.name,
      description: project.description || null,
      status: 'ACTIVE',
      current_objective: project.current_objective || null,
      created_at: now,
      updated_at: now
    };
  }

  static async getProjects(userId: string, status: string = 'ACTIVE'): Promise<Project[]> {
    const db = await getDb();
    return db.all('SELECT * FROM projects WHERE user_id = ? AND status = ? ORDER BY updated_at DESC', [userId, status]);
  }

  // ─── 4. Outcomes ──────────────────────────────────────────────────────────
  static async createOutcome(outcome: {
    user_id: string;
    goal_id?: string | null;
    project_id?: string | null;
    title: string;
    description?: string | null;
    desired_result?: string | null;
    current_state?: string | null;
    owner?: OutcomeOwner;
    importance?: number;
    deadline?: string | null;
  }): Promise<Outcome> {
    const db = await getDb();
    const id = `out_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const owner = outcome.owner || 'USER';

    await db.run(
      `INSERT INTO outcomes (id, user_id, goal_id, project_id, title, description, desired_result, current_state, owner, status, importance, deadline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', ?, ?, ?, ?)`,
      [
        id,
        outcome.user_id,
        outcome.goal_id || null,
        outcome.project_id || null,
        outcome.title,
        outcome.description || null,
        outcome.desired_result || null,
        outcome.current_state || null,
        owner,
        outcome.importance ?? 0.5,
        outcome.deadline || null,
        now,
        now
      ]
    );

    return {
      id,
      user_id: outcome.user_id,
      goal_id: outcome.goal_id || null,
      project_id: outcome.project_id || null,
      title: outcome.title,
      description: outcome.description || null,
      desired_result: outcome.desired_result || null,
      current_state: outcome.current_state || null,
      owner,
      status: 'NOT_STARTED',
      importance: outcome.importance ?? 0.5,
      deadline: outcome.deadline || null,
      created_at: now,
      updated_at: now
    };
  }

  static async getOutcomes(userId: string, status?: string): Promise<Outcome[]> {
    const db = await getDb();
    if (status) {
      return db.all('SELECT * FROM outcomes WHERE user_id = ? AND status = ? ORDER BY importance DESC, created_at DESC', [userId, status]);
    }
    return db.all('SELECT * FROM outcomes WHERE user_id = ? AND status != "CANCELLED" ORDER BY importance DESC, created_at DESC', [userId]);
  }

  static async updateOutcomeStatus(id: string, status: string): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run('UPDATE outcomes SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  }

  // ─── 5. Commitments ───────────────────────────────────────────────────────
  static async createCommitment(comm: {
    user_id: string;
    title: string;
    description?: string | null;
    starts_at?: string | null;
    due_at?: string | null;
    source?: string | null;
    consequence?: string | null;
    importance?: number;
    related_outcome_id?: string | null;
  }): Promise<Commitment> {
    const db = await getDb();
    const id = `comm_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO commitments (id, user_id, title, description, starts_at, due_at, source, consequence, importance, status, related_outcome_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [
        id,
        comm.user_id,
        comm.title,
        comm.description || null,
        comm.starts_at || null,
        comm.due_at || null,
        comm.source || 'USER_EXPLICIT',
        comm.consequence || null,
        comm.importance ?? 0.5,
        comm.related_outcome_id || null,
        now,
        now
      ]
    );

    return {
      id,
      user_id: comm.user_id,
      title: comm.title,
      description: comm.description || null,
      starts_at: comm.starts_at || null,
      due_at: comm.due_at || null,
      source: comm.source || 'USER_EXPLICIT',
      consequence: comm.consequence || null,
      importance: comm.importance ?? 0.5,
      status: 'PENDING',
      related_outcome_id: comm.related_outcome_id || null,
      created_at: now,
      updated_at: now
    };
  }

  static async getCommitments(userId: string, status: string = 'PENDING'): Promise<Commitment[]> {
    const db = await getDb();
    return db.all('SELECT * FROM commitments WHERE user_id = ? AND status = ? ORDER BY due_at ASC, importance DESC', [userId, status]);
  }

  // ─── 6. Rules ─────────────────────────────────────────────────────────────
  static async createRule(rule: {
    user_id: string;
    statement: string;
    scope?: string | null;
    priority?: number;
    conditions?: Record<string, any> | null;
    exceptions?: Record<string, any> | null;
    source?: string | null;
  }): Promise<Rule> {
    const db = await getDb();
    const id = `rule_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO rules (id, user_id, statement, scope, priority, conditions, exceptions, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [
        id,
        rule.user_id,
        rule.statement,
        rule.scope || 'GENERAL',
        rule.priority ?? 1,
        rule.conditions ? JSON.stringify(rule.conditions) : '{}',
        rule.exceptions ? JSON.stringify(rule.exceptions) : '{}',
        rule.source || 'USER_EXPLICIT',
        now,
        now
      ]
    );

    return {
      id,
      user_id: rule.user_id,
      statement: rule.statement,
      scope: rule.scope || 'GENERAL',
      priority: rule.priority ?? 1,
      conditions: rule.conditions || {},
      exceptions: rule.exceptions || {},
      source: rule.source || 'USER_EXPLICIT',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    };
  }

  static async getRules(userId: string, status: string = 'ACTIVE'): Promise<Rule[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM rules WHERE user_id = ? AND status = ? ORDER BY priority ASC, created_at DESC', [userId, status]);
    return rows.map((r: any) => ({
      ...r,
      conditions: r.conditions ? JSON.parse(r.conditions) : {},
      exceptions: r.exceptions ? JSON.parse(r.exceptions) : {}
    }));
  }

  // ─── 7. Preferences ───────────────────────────────────────────────────────
  static async createPreference(pref: {
    user_id: string;
    statement: string;
    scope?: string | null;
    confidence?: number;
    source?: string | null;
  }): Promise<Preference> {
    const db = await getDb();
    const id = `pref_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO preferences (id, user_id, statement, scope, confidence, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [
        id,
        pref.user_id,
        pref.statement,
        pref.scope || 'GENERAL',
        pref.confidence ?? 0.8,
        pref.source || 'USER_EXPLICIT',
        now,
        now
      ]
    );

    return {
      id,
      user_id: pref.user_id,
      statement: pref.statement,
      scope: pref.scope || 'GENERAL',
      confidence: pref.confidence ?? 0.8,
      source: pref.source || 'USER_EXPLICIT',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    };
  }

  static async getPreferences(userId: string, status: string = 'ACTIVE'): Promise<Preference[]> {
    const db = await getDb();
    return db.all('SELECT * FROM preferences WHERE user_id = ? AND status = ? ORDER BY confidence DESC', [userId, status]);
  }

  // ─── 8. Decisions (with Supersession) ──────────────────────────────────────
  static async recordDecision(dec: {
    user_id: string;
    statement: string;
    reason?: string | null;
    scope?: string | null;
    evidence_refs?: string[];
    alternatives?: string[];
    supersedes_id?: string | null;
    effective_from?: string | null;
    review_at?: string | null;
  }): Promise<Decision> {
    const db = await getDb();
    const id = `dec_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // If supersedes_id is provided, transition the previous decision from ACTIVE to SUPERSEDED
    if (dec.supersedes_id) {
      await db.run(
        'UPDATE decisions SET status = "SUPERSEDED" WHERE id = ? AND user_id = ?',
        [dec.supersedes_id, dec.user_id]
      );
    }

    await db.run(
      `INSERT INTO decisions (id, user_id, statement, reason, scope, evidence_refs, alternatives, status, effective_from, review_at, supersedes_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
      [
        id,
        dec.user_id,
        dec.statement,
        dec.reason || null,
        dec.scope || 'GENERAL',
        dec.evidence_refs ? JSON.stringify(dec.evidence_refs) : '[]',
        dec.alternatives ? JSON.stringify(dec.alternatives) : '[]',
        dec.effective_from || now,
        dec.review_at || null,
        dec.supersedes_id || null,
        now
      ]
    );

    return {
      id,
      user_id: dec.user_id,
      statement: dec.statement,
      reason: dec.reason || null,
      scope: dec.scope || 'GENERAL',
      evidence_refs: dec.evidence_refs || [],
      alternatives: dec.alternatives || [],
      status: 'ACTIVE',
      effective_from: dec.effective_from || now,
      review_at: dec.review_at || null,
      supersedes_id: dec.supersedes_id || null,
      created_at: now
    };
  }

  static async getDecisions(userId: string, status: string = 'ACTIVE'): Promise<Decision[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM decisions WHERE user_id = ? AND status = ? ORDER BY created_at DESC', [userId, status]);
    return rows.map((r: any) => ({
      ...r,
      evidence_refs: r.evidence_refs ? JSON.parse(r.evidence_refs) : [],
      alternatives: r.alternatives ? JSON.parse(r.alternatives) : []
    }));
  }

  // ─── 9. Patterns ──────────────────────────────────────────────────────────
  static async recordPattern(pattern: {
    user_id: string;
    statement: string;
    confidence?: number;
    frequency?: number;
    confirmation_status?: 'UNCONFIRMED' | 'CONFIRMED' | 'REJECTED';
    evidence_refs?: string[];
  }): Promise<Pattern> {
    const db = await getDb();
    const id = `pat_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO patterns (id, user_id, statement, evidence_refs, confidence, frequency, confirmation_status, first_observed_at, last_observed_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        id,
        pattern.user_id,
        pattern.statement,
        pattern.evidence_refs ? JSON.stringify(pattern.evidence_refs) : '[]',
        pattern.confidence ?? 0.5,
        pattern.frequency ?? 1.0,
        pattern.confirmation_status || 'UNCONFIRMED',
        now,
        now
      ]
    );

    return {
      id,
      user_id: pattern.user_id,
      statement: pattern.statement,
      evidence_refs: pattern.evidence_refs || [],
      confidence: pattern.confidence ?? 0.5,
      frequency: pattern.frequency ?? 1.0,
      confirmation_status: pattern.confirmation_status || 'UNCONFIRMED',
      first_observed_at: now,
      last_observed_at: now,
      status: 'ACTIVE'
    };
  }

  static async getPatterns(userId: string, status: string = 'ACTIVE'): Promise<Pattern[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM patterns WHERE user_id = ? AND status = ? ORDER BY confidence DESC', [userId, status]);
    return rows.map((r: any) => ({
      ...r,
      evidence_refs: r.evidence_refs ? JSON.parse(r.evidence_refs) : []
    }));
  }

  // ─── 10. Current State ────────────────────────────────────────────────────
  static async getCurrentState(userId: string): Promise<CurrentState | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM current_state WHERE user_id = ?', [userId]);
    if (!row) return null;
    return {
      ...row,
      active_constraints: row.active_constraints ? JSON.parse(row.active_constraints) : [],
      recent_events: row.recent_events ? JSON.parse(row.recent_events) : []
    };
  }

  static async updateCurrentState(userId: string, patch: Partial<CurrentState>): Promise<CurrentState> {
    const db = await getDb();
    const existing = await this.getCurrentState(userId);
    const now = new Date().toISOString();

    const merged: CurrentState = {
      user_id: userId,
      current_activity: patch.current_activity !== undefined ? patch.current_activity : (existing?.current_activity || null),
      current_focus: patch.current_focus !== undefined ? patch.current_focus : (existing?.current_focus || null),
      active_outcome_id: patch.active_outcome_id !== undefined ? patch.active_outcome_id : (existing?.active_outcome_id || null),
      available_time_window: patch.available_time_window !== undefined ? patch.available_time_window : (existing?.available_time_window || 60),
      active_constraints: patch.active_constraints !== undefined ? patch.active_constraints : (existing?.active_constraints || []),
      recent_events: patch.recent_events !== undefined ? patch.recent_events : (existing?.recent_events || []),
      last_updated_at: now
    };

    await db.run(
      `INSERT INTO current_state (user_id, current_activity, current_focus, active_outcome_id, available_time_window, active_constraints, recent_events, last_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         current_activity = excluded.current_activity,
         current_focus = excluded.current_focus,
         active_outcome_id = excluded.active_outcome_id,
         available_time_window = excluded.available_time_window,
         active_constraints = excluded.active_constraints,
         recent_events = excluded.recent_events,
         last_updated_at = excluded.last_updated_at`,
      [
        merged.user_id,
        merged.current_activity,
        merged.current_focus,
        merged.active_outcome_id,
        merged.available_time_window,
        JSON.stringify(merged.active_constraints || []),
        JSON.stringify(merged.recent_events || []),
        now
      ]
    );

    return merged;
  }

  // ─── 11. Personal Model Overview Aggregation ──────────────────────────────
  static async getOverview(userId: string): Promise<PersonalModelOverview> {
    const [
      user,
      currentState,
      goals,
      outcomes,
      projects,
      commitments,
      rules,
      preferences,
      decisions,
      patterns
    ] = await Promise.all([
      this.getUser(userId),
      this.getCurrentState(userId),
      this.getGoals(userId),
      this.getOutcomes(userId),
      this.getProjects(userId),
      this.getCommitments(userId),
      this.getRules(userId),
      this.getPreferences(userId),
      this.getDecisions(userId),
      this.getPatterns(userId)
    ]);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return {
      user,
      currentState,
      goals,
      outcomes,
      projects,
      commitments,
      rules,
      preferences,
      decisions,
      patterns
    };
  }
}
