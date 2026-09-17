export interface Command {
  id: string;
  user_id: string;
  title: string;
  reason: string;
  estimated_minutes: number;
  status: 'active' | 'completed' | 'delayed' | 'skipped';
  ignored_count: number;
  issued_at: string;
  completed_at: string | null;
  context_snapshot: Record<string, any> | null;
}

export type ConstitutionCategory = 'sleep' | 'health' | 'work' | 'recovery' | 'priority';

export interface ConstitutionRule {
  id: string;
  user_id: string;
  rule_text: string;
  category: ConstitutionCategory;
  is_active: boolean;
  created_at: string;
}

export interface TaskItem {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'completed';
  due_date?: string;
  source: 'notion' | 'github' | 'manual';
  source_id?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  description?: string;
  location?: string;
  source?: 'LOCAL' | 'GOOGLE' | 'ICLOUD' | 'MANUAL';
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContextState {
  id: string;
  user_id: string;
  current_energy: number; // 1-10
  focus_score: number; // 1-10
  tasks_today: TaskItem[];
  meetings_today: CalendarEvent[];
  goals: string[];
  last_updated_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider: 'google' | 'notion' | 'github' | 'gmail';
  connected: boolean;
  connected_at: string;
  last_synced_at: string | null;
}

export interface DailyBrief {
  id: string;
  user_id: string;
  type: 'morning' | 'evening';
  content: {
    objective: string;
    meetings: string[];
    risks: string[];
    completed_work?: string[];
    missed_work?: string[];
    tomorrow_priority?: string;
  };
  generated_at: string;
  acknowledged_at: string | null;
}

export interface ReasoningRequest {
  context: Partial<ContextState>;
  constitution: ConstitutionRule[];
  mission: string;
  instruction: string;
}

export interface ReasoningResponse {
  command: {
    title: string;
    reason: string;
    estimated_minutes: number;
  };
  rationale: string;
  confidence: number;
  meta?: Record<string, any>;
}

export interface Portrait {
  name: string;
  identity: string;         // Who you are trying to become
  values: string;           // Why does that matter & What gives life meaning
  principles: string;       // Guiding principles
  strengths: string;        // Strengths you rely on
  blind_spots: string;      // Fears / struggles / weaknesses / blind spots
  dreams: string;           // Ambitions / projects / what you are building
  relationships: string;    // Crucial relationships & circle
  decision_patterns: string[]; // Decision patterns noticed
  growth: string[];         // Chronological growth / biography logs
  cognitiveProfile: {
    problemSolvingStyle: string;
    temporalBias: string;
    attentionSpan: string;
    decisionHeuristics: string;
  };
  activeBeliefs: Array<{
    belief: string;
    strength: number; // 0.0 to 1.0 representation
    lastTested: string;
    evolution: string;
  }>;
  // Extended psychological model
  emotionalTrends?: Array<{
    date: string;
    sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
    note: string;
  }>;
  behavioralPatterns?: Array<{
    pattern: string;
    frequency: 'daily' | 'weekly' | 'occasional';
    lastSeen: string;
  }>;
  identityEvolution?: Array<{
    date: string;
    previous: string;
    current: string;
    catalyst: string;
  }>;
}

export interface Journey {
  id: string;
  category: 'mental' | 'physical' | 'financial' | 'relationships' | 'legacy';
  icon: string;
  title: string;
  currentState: string;
  vision: string;
  milestones: Array<{ id: string; text: string; completed: boolean }>;
  memories: string[];
  lessons: string[];
  progress: number; // 0-100 percentage
  timeline: Array<{ date: string; text: string }>;
}

export interface LibraryItem {
  id: string;
  type: 'book' | 'idea' | 'quote' | 'note' | 'lesson';
  title: string;
  author?: string;
  content: string;
  dateAdded: string;
  tags: string[];
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export type MemoryNodeType =
  | 'person'
  | 'project'
  | 'belief'
  | 'routine'
  | 'goal'
  | 'event'
  | 'organization'
  | 'concept';

export interface MemoryNode {
  id: string;
  type: MemoryNodeType;
  label: string;           // e.g. "Atlas", "MGE", "procrastination"
  description: string;
  confidence: number;      // 0.0–1.0 — decays if stale
  lastUpdated: string;     // ISO timestamp
  metadata: Record<string, any>; // flexible: { status, priority, url, etc. }
}

export type MemoryRelation =
  | 'works_on'
  | 'fears'
  | 'motivated_by'
  | 'relates_to'
  | 'knows'
  | 'blocked_by'
  | 'aspires_to'
  | 'part_of'
  | 'contradicts';

export interface MemoryEdge {
  id: string;
  fromId: string;          // MemoryNode.id
  toId: string;            // MemoryNode.id
  relation: MemoryRelation;
  strength: number;        // 0.0–1.0
  createdAt: string;       // ISO timestamp
}

export interface WorldModel {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  lastUpdated: string;
}

// ─── Proactive System ─────────────────────────────────────────────────────────

export type ProactiveSignalType =
  | 'daily_checkin'
  | 'pattern_alert'
  | 'goal_reminder'
  | 'weekly_review'
  | 'victory_recognition'
  | 'setback_support';

export interface ProactiveSignal {
  id: string;
  type: ProactiveSignalType;
  triggerTime: string;     // ISO timestamp
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

// ─── Action Layer ─────────────────────────────────────────────────────────────

export type ActionType =
  | 'create_task'
  | 'notion_update'
  | 'schedule_reminder'
  | 'atlas_coordinate'
  | 'organize_project'
  | 'send_briefing';

export interface ActionRequest {
  type: ActionType;
  title: string;
  payload: Record<string, any>; // action-specific data
  priority?: 'high' | 'medium' | 'low';
  triggeredBy?: string;         // "conversation" | "pattern_engine" | "user"
}

export interface ActionLog {
  id: string;
  actionType: ActionType;
  payload: Record<string, any>;
  status: 'pending' | 'executed' | 'failed';
  createdAt: string;
  executedAt?: string;
  error?: string;
}

// ─── Real-Time Intelligence ───────────────────────────────────────────────────

export type InsightType =
  | 'recurring_theme'
  | 'contradiction'
  | 'progress_detected'
  | 'regression_detected'
  | 'emotional_shift'
  | 'pattern_alert';

export interface RealtimeInsight {
  type: InsightType;
  label: string;           // Short human-readable label
  detail: string;          // Full observation sentence
  count?: number;          // For recurring: how many times
  timeframe?: string;      // "this week", "today", etc.
  confidence: number;      // 0.0–1.0
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface ConversationContext {
  portrait: Portrait;
  worldModel: WorldModel;
  recentInsights: RealtimeInsight[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  activeProactiveSignals: ProactiveSignal[];
  energyLevel?: number;    // Pulled from portrait / chronicle sentiment
}

// ─── Reasoner Response (extended) ────────────────────────────────────────────

export interface ReasonerResponse {
  reply: string;
  insights: RealtimeInsight[];
  suggestedActions?: ActionRequest[];
  proactiveSignal?: ProactiveSignal;
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── ORION BUILD SPEC V1 — CANONICAL DOMAIN ENTITIES & CONTRACTS ─────────────
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Personal Model Core Entities ─────────────────────────────────────────

export interface User {
  id: string;
  display_name: string;
  timezone: string;
  locale?: string;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Value {
  id: string;
  user_id: string;
  statement: string;
  domain?: string;
  priority?: number;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  parent_goal_id?: string | null;
  title: string;
  description?: string | null;
  domain?: string | null;
  horizon?: string | null;
  importance?: number | null;
  desired_state?: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | string;
  review_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type OutcomeOwner = 'USER' | 'ORION' | 'SHARED' | 'EXTERNAL';

export interface Outcome {
  id: string;
  user_id: string;
  goal_id?: string | null;
  project_id?: string | null;
  title: string;
  description?: string | null;
  desired_result?: string | null;
  current_state?: string | null;
  owner: OutcomeOwner;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | string;
  importance?: number | null;
  deadline?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED' | string;
  current_objective?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commitment {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  starts_at?: string | null;
  due_at?: string | null;
  source?: string | null;
  consequence?: string | null;
  importance?: number | null;
  status: 'PENDING' | 'FULFILLED' | 'BROKEN' | 'CANCELLED' | string;
  related_outcome_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rule {
  id: string;
  user_id: string;
  statement: string;
  scope?: string | null;
  priority: number;
  conditions?: Record<string, any> | null;
  exceptions?: Record<string, any> | null;
  source?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUPERSEDED' | string;
  created_at: string;
  updated_at: string;
}

export interface Preference {
  id: string;
  user_id: string;
  statement: string;
  scope?: string | null;
  confidence: number;
  source?: string | null;
  status: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED' | string;
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: string;
  user_id: string;
  statement: string;
  reason?: string | null;
  scope?: string | null;
  evidence_refs?: string[] | Record<string, any> | null;
  alternatives?: string[] | Record<string, any> | null;
  status: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED' | string;
  effective_from?: string | null;
  review_at?: string | null;
  supersedes_id?: string | null;
  created_at: string;
}

export interface Pattern {
  id: string;
  user_id: string;
  statement: string;
  evidence_refs?: string[] | Record<string, any> | null;
  confidence: number;
  frequency: number;
  confirmation_status: 'UNCONFIRMED' | 'CONFIRMED' | 'REJECTED' | string;
  first_observed_at?: string | null;
  last_observed_at?: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | string;
}

export interface CurrentState {
  user_id: string;
  current_activity?: string | null;
  current_focus?: string | null;
  active_outcome_id?: string | null;
  available_time_window?: number | null; // in minutes
  active_constraints?: string[] | null;
  recent_events?: Record<string, any>[] | null;
  last_updated_at: string;
}

export interface Relationship {
  id: string;
  user_id: string;
  name: string;
  relationship_type?: string | null;
  context?: string | null;
  importance?: number | null;
  last_interaction_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Knowledge {
  id: string;
  user_id: string;
  topic: string;
  status: 'ACQUIRED' | 'ACQUIRING' | 'EXTERNAL' | 'UNVERIFIED';
  content: string;
  confidence?: number | null;
  source?: string | null;
  updated_at: string;
}

export interface Resource {
  id: string;
  user_id: string;
  type: 'time' | 'money' | 'tool' | 'software' | 'file' | 'person' | string;
  name: string;
  description?: string | null;
  capacity?: string | null;
  constraints?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  updated_at: string;
}

// ─── 2. Agency & Permissions ──────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Permission {
  id: string;
  user_id: string;
  tool: string;
  capability: string;
  scope?: Record<string, any> | null;
  risk_level: RiskLevel;
  mode: 'ONE_TIME' | 'SESSION' | 'ALWAYS' | string;
  conditions?: Record<string, any> | null;
  expires_at?: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | string;
  created_at: string;
}

export type ActionStatus =
  | 'PROPOSED'
  | 'PERMISSION_CHECK'
  | 'WAITING_APPROVAL'
  | 'READY'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface Action {
  id: string;
  user_id: string;
  outcome_id?: string | null;
  description: string;
  actor: 'USER' | 'ORION' | 'SHARED';
  tool?: string | null;
  capability?: string | null;
  payload?: Record<string, any> | null;
  idempotency_key?: string | null;
  risk_level: RiskLevel;
  authorization?: string | null;
  status: ActionStatus;
  verification_result?: VerificationResult | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ActionStep {
  id: string;
  action_id: string;
  sequence: number;
  description: string;
  tool?: string | null;
  input_ref?: string | null;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  result_ref?: string | null;
  verification_status?: 'UNVERIFIED' | 'VERIFIED' | 'FAILED' | null;
}

// ─── 3. Events & Notifications ────────────────────────────────────────────────

export interface OrionEvent {
  id: string;
  user_id: string;
  source: string;
  source_event_id?: string | null;
  type: string;
  payload_ref?: string | null;
  occurred_at: string;
  processed_at?: string | null;
  relevance?: number | null;
  status: 'UNPROCESSED' | 'PROCESSED' | 'IGNORED' | string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  reason?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  created_at: string;
  delivered_at?: string | null;
  dismissed_at?: string | null;
  outcome?: string | null;
}

// ─── 4. Context & Reasoning Contracts ─────────────────────────────────────────

export type Intent =
  | 'Information'
  | 'Explanation'
  | 'Reflection'
  | 'Decision'
  | 'Planning'
  | 'Execution'
  | 'Research'
  | 'Creation'
  | 'Monitoring'
  | 'Intervention'
  | 'Conversation';

export type UncertaintyLevel =
  | 'KNOWN'
  | 'SUPPORTED_INFERENCE'
  | 'WEAK_INFERENCE'
  | 'UNKNOWN'
  | 'CONFLICTING';

export interface ContextPack {
  intent: Intent;
  desiredOutcome?: string;
  currentState: Partial<CurrentState>;
  goals: Goal[];
  commitments: Commitment[];
  rules: Rule[];
  decisions: Decision[];
  projects: Project[];
  outcomes: Outcome[];
  relevantHistory?: string[];
  externalEvidence?: Record<string, any>[];
  conflicts?: string[];
  uncertainties?: Array<{ subject: string; level: UncertaintyLevel; note: string }>;
  constraints?: string[];
  availableActions?: string[];
}

export interface Recommendation {
  what: string;
  why: string;
  evidence?: string[];
  consequences?: string[];
  tradeOffs?: string[];
  alternative?: string;
  nextStep?: string;
  uncertainty?: string;
}

export interface AuthorityCheck {
  userId: string;
  tool: string;
  capability: string;
  scope?: Record<string, any>;
  riskLevel: RiskLevel;
}

export interface AuthorityDecision {
  permitted: boolean;
  requiresApproval: boolean;
  permissionId?: string;
  reason: string;
}

export interface AuthorityContext {
  userId: string;
  activePermissions: Permission[];
}

export interface Alternative {
  title: string;
  description: string;
  tradeOff: string;
}

export interface Consequence {
  description: string;
  severity: 'low' | 'medium' | 'high';
  domain: string;
  likelihood: 'likely' | 'possible' | 'certain';
}

export interface Uncertainty {
  subject: string;
  level: UncertaintyLevel;
  note: string;
}

export interface ProposedAction {
  id?: string;
  description: string;
  actor: 'USER' | 'ORION' | 'SHARED';
  tool?: string | null;
  capability?: string | null;
  parameters?: Record<string, any>;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  reversible?: boolean;
}

export interface StateChange {
  entityType: string;
  entityId: string;
  changeType: 'created' | 'updated' | 'deleted' | 'superseded';
  summary: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface ReasoningInput {
  request: string;
  context: ContextPack;
  authority?: AuthorityContext;
}

export interface ReasoningResult {
  interpretation: string;
  recommendation?: Recommendation;
  alternatives?: Alternative[];
  consequences?: Consequence[];
  uncertainties?: Uncertainty[];
  evidenceRefs?: string[];
  proposedActions?: ProposedAction[];
  challenged?: boolean;
  challengeReason?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  order: number;
  completed: boolean;
  dueDate?: string;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface Dependency {
  id: string;
  description: string;
  dependsOn: string;
  status: 'pending' | 'resolved' | 'blocked';
}

export interface Blocker {
  id: string;
  description: string;
  severity: 'minor' | 'critical';
  mitigation?: string;
}

export interface Assumption {
  id: string;
  statement: string;
  impactIfFalse: string;
}

export interface ReviewCondition {
  trigger: string;
  action: string;
}

export interface CalendarContext {
  events: CalendarEvent[];
  availableWindowsMinutes: number[];
  availability?: AvailabilityResult;
}

// ─── Phase 4: Calendar & Availability Contracts ───────────────────────────────

export interface TimeWindow {
  start: string;
  end: string;
  durationMinutes: number;
  isDeepWork: boolean;
}

export interface AvailabilityOptions {
  dayStartHour?: number;   // default 9
  dayEndHour?: number;     // default 21
  deepWorkThreshold?: number; // default 90 minutes
  bufferMinutes?: number;  // default 0
}

export interface AvailabilityResult {
  date: string;
  totalFreeMinutes: number;
  deepWorkMinutes: number;
  busyIntervals: Array<{ title: string; start: string; end: string; durationMinutes: number }>;
  freeWindows: TimeWindow[];
  ruleViolations?: Array<{ rule: string; event: string }>;
}

export type PlanValidationStatus = 'VALID' | 'COLLISION' | 'CAPACITY_EXCEEDED' | 'DEADLINE_JEOPARDY';
export type PlanValidationAction = 'NONE' | 'REPLAN' | 'NOTIFY_USER' | 'RESCHEDULE_BLOCKS';

export interface PlanValidationResult {
  valid: boolean;
  status: PlanValidationStatus;
  reason?: string;
  conflictingEvents?: CalendarEvent[];
  affectedScheduleBlocks?: ScheduleBlock[];
  recommendedAction: PlanValidationAction;
}

export interface CalendarProvider {
  getEvents(userId: string, startDate?: string, endDate?: string): Promise<CalendarEvent[]>;
  getEventById(userId: string, id: string): Promise<CalendarEvent | null>;
  createEvent(userId: string, event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent>;
  updateEvent(userId: string, id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent>;
  deleteEvent(userId: string, id: string): Promise<boolean>;
}

export interface Plan {
  outcomeId: string;
  rationale: string;
  milestones: Milestone[];
  nextAction?: ProposedAction;
  schedule: ScheduleBlock[];
  dependencies: Dependency[];
  blockers: Blocker[];
  assumptions: Assumption[];
  reviewConditions: ReviewCondition[];
}

export interface PlanningInput {
  outcome: Outcome;
  currentState: Partial<CurrentState>;
  context: ContextPack;
  calendar?: CalendarContext;
  existingPlan?: Plan;
}

export interface OrionRequest {
  userId: string;
  message?: string;
  eventId?: string;
  surface?: string;
  selectedContent?: unknown;
}

export interface OrionResponse {
  message: string;
  intent: Intent;
  contextRefs: string[];
  recommendation?: Recommendation;
  plan?: Plan;
  actions?: ProposedAction[];
  needsApproval?: boolean;
  stateChanges?: StateChange[];
  challenged?: boolean;
}

export interface ContextRequest {
  userId: string;
  intent: Intent;
  request: string;
  currentEntityIds?: string[];
  freshnessRequirement?: 'realtime' | 'fresh' | 'normal' | 'historical';
}

// ─── 5. Tools & Verification Contracts ────────────────────────────────────────

export interface ToolCapability {
  name: string;
  description: string;
  inputSchema: unknown;
  riskLevel: RiskLevel;
  reversible: boolean;
}

export interface ToolResult {
  success: boolean;
  status: string;
  source: string;
  data?: unknown;
  createdEntities?: Array<{ type: string; id: string }>;
  changedEntities?: Array<{ type: string; id: string }>;
  error?: { code: string; message: string; details?: unknown };
}

export interface VerificationResult {
  verified: boolean;
  details?: string;
  timestamp: string;
}

export interface OrionTool {
  name: string;
  capabilities(): ToolCapability[];
  execute(capability: string, input: unknown): Promise<ToolResult>;
  verify(capability: string, result: ToolResult): Promise<VerificationResult>;
}

// ─── 6. Personal Model Aggregation ────────────────────────────────────────────

export interface PersonalModelOverview {
  user: User;
  currentState: CurrentState | null;
  goals: Goal[];
  outcomes: Outcome[];
  projects: Project[];
  commitments: Commitment[];
  rules: Rule[];
  preferences: Preference[];
  decisions: Decision[];
  patterns: Pattern[];
}

// ─── 7. Memory Classification & Lifecycle Contracts (Sections 6, 7, 12) ──────

export type MemoryClassificationType =
  | 'FACT'
  | 'GOAL'
  | 'OUTCOME'
  | 'COMMITMENT'
  | 'RULE'
  | 'PREFERENCE'
  | 'DECISION'
  | 'PATTERN'
  | 'TEMPORARY_STATE'
  | 'KNOWLEDGE'
  | 'NOT_MEMORY';

export interface MemoryCandidate {
  text: string;
  source?: 'USER_EXPLICIT' | 'CONVERSATION' | 'TOOL_RESULT' | 'EXTERNAL';
  timestamp?: string;
  contextSnapshot?: Record<string, any>;
}

export interface ClassifiedMemory {
  candidate: MemoryCandidate;
  type: MemoryClassificationType;
  confidence: number;
  persist: boolean;
  scope: 'GENERAL' | 'WORK' | 'HEALTH' | 'SESSION' | string;
  authority: 'EXPLICIT_USER' | 'SUPPORTED_INFERENCE' | 'WEAK_INFERENCE';
  expiration?: string | null;
  needsConfirmation: boolean;
  proposedEntity?: {
    table: 'goals' | 'outcomes' | 'commitments' | 'rules' | 'preferences' | 'decisions' | 'patterns' | 'knowledge' | 'temporary';
    data: Record<string, any>;
  };
  reasoning: string;
}

export interface PromotionResult {
  promoted: boolean;
  type: MemoryClassificationType;
  entityId?: string;
  table?: string;
  supersededId?: string | null;
  needsConfirmation?: boolean;
  message: string;
}

export interface MemoryQuery {
  query: string;
  userId?: string;
  limit?: number;
  types?: string[];
  minConfidence?: number;
}

export interface MemoryResult {
  id: string;
  text: string;
  type: string;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, any>;
  score?: number;
}

export interface MemoryRecord {
  id?: string;
  userId: string;
  text: string;
  type: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface MemoryProvider {
  search(query: MemoryQuery): Promise<MemoryResult[]>;
  retrieve(id: string): Promise<MemoryResult | null>;
  store(memory: MemoryRecord): Promise<string>;
  update(id: string, patch: Record<string, any>): Promise<void>;
  forget(id: string): Promise<void>;
}

// ─── Phase 6: Home UX, Approval UX & Action Centre (Sections 25, 26, 27) ─────

export type OrionOrbState =
  | 'breathing'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'speaking'
  | 'working'
  | 'needs_you'
  | 'error';

export interface PendingApprovalItem {
  id: string;
  tool: string;
  capability: string;
  what: string;
  why: string;
  whatWillChange: {
    target: string;
    from?: string | null;
    to: string;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stagedAt: string;
  supportsRollback: boolean;
}

export interface HomeOrientation {
  proactiveSpeech?: {
    text: string;
    reason: string;
  } | null;
  orbState: OrionOrbState;
  pendingApprovals: PendingApprovalItem[];
  focusContext?: {
    currentActivity?: string;
    availableMinutes?: number;
  };
}

export interface ProactivityContext {
  userId: string;
  pendingActions: Action[];
  calendarEvents: CalendarEvent[];
  currentState: CurrentState | null;
  now: Date;
}

export interface ProactiveSpeechItem {
  text: string;
  reason: string;
  targetOrbState?: OrionOrbState;
}

export interface ProactivityRule {
  id: string;
  evaluate: (context: ProactivityContext) => Promise<ProactiveSpeechItem | null>;
}

// ─── Phase 7: Complete UX Architecture (UX Spec V1) ──────────────────────────

/** All navigable environments in the Orion product. */
export type OrionEnvironment =
  | 'LIVING_MODE'
  | 'TEXT_MODE'
  | 'NEEDS_YOU'
  | 'ACTION_CENTRE'
  | 'JOURNEY'
  | 'MEMORY'
  | 'CALENDAR'
  | 'EMAIL'
  | 'BROWSER'
  | 'PROJECT'
  | 'CONNECTED_WORLD'
  | 'SETTINGS';

/** Lifecycle of a single voice capture session. */
export type VoiceSessionState =
  | 'IDLE'
  | 'REQUEST_PERMISSION'
  | 'STARTING'
  | 'LISTENING'
  | 'PROCESSING'
  | 'PLAYING'
  | 'INTERRUPTED'
  | 'ENDED'
  | 'ERROR';

/** Extended approval states including the editing step. */
export type ApprovalState =
  | 'WAITING_APPROVAL'
  | 'EDITING'
  | 'APPROVED'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'FAILED'
  | 'REJECTED';

/** Action Centre grouping state for display. */
export type ActionCentreTab = 'NEEDS_YOU' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'FAILED';

/** A single memory record in Orion's model of the user. */
export interface OrionMemoryRecord {
  id: string;
  category: 'GOAL' | 'RULE' | 'PREFERENCE' | 'DECISION' | 'PATTERN' | 'CURRENT_STATE' | 'INTEREST';
  statement: string;
  scope: 'TEMPORARY' | 'SESSION' | 'PERSISTENT' | 'PERMANENT';
  status: 'ACTIVE' | 'SUPERSEDED' | 'RETRACTED';
  source: 'ONBOARDING' | 'CONVERSATION' | 'INFERRED' | 'USER_EXPLICIT';
  confidence?: number; // 0-1, optional
  lastUpdatedAt: string;
  createdAt: string;
}

/** Evidence item for the Journey environment. */
export interface JourneyEvidence {
  id: string;
  type: 'ACTION' | 'PROJECT' | 'SKILL' | 'OUTCOME' | 'BEHAVIOUR' | 'LEARNING';
  description: string;
  date: string;
  relevance: string;
}

/** A tension/contradiction observed in the Journey environment. */
export interface JourneyTension {
  id: string;
  observation: string;
  supportingEvidence: string[];
  confidence: 'INFERENCE' | 'SUPPORTED' | 'CONFIRMED';
}

/** Full Journey state for the Journey environment. */
export interface JourneyState {
  direction: string; // "Who am I becoming?"
  currentDevelopment: string;
  evidence: JourneyEvidence[];
  tensions: JourneyTension[];
  lastUpdatedAt: string;
}

/** Proactivity preference set during onboarding. */
export type ProactivityLevel = 'QUIET' | 'BALANCED' | 'PROACTIVE';

/** Onboarding completion payload (extended). */
export interface OnboardingPayload {
  username: string;
  proactivityLevel: ProactivityLevel;
  portrait: Portrait;
  journeys: Journey[];
  library: LibraryItem[];
  rules: ConstitutionRule[];
  context: Partial<ContextState>;
  integrations: Integration[];
}

