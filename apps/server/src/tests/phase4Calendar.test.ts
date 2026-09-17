process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDb, closeDb } from '../db';
import { calendarAdapter } from '../services/calendar/calendarAdapter';
import { availabilityEngine } from '../services/calendar/availabilityEngine';
import { planInvalidationService } from '../services/calendar/planInvalidationService';
import { PlanningService } from '../services/cognitive/planningEngine';
import { PersonalModelService } from '../services/personalModel/personalModelService';
import type { CalendarEvent, Plan, Outcome } from '@orion/types';

describe('Orion Build Spec V1 — Phase 4 Calendar & Schedule-Aware Planning Tests', () => {
  const userId = 'user_ben_phase4';
  const testDateStr = '2026-09-20';
  let server: http.Server;
  let app: any;
  const testPort = 3010;
  let testOutcome: Outcome;

  before(async () => {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, display_name, timezone, locale, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Ben (Phase 4 Test)', 'Europe/London', 'en-GB', '{}', now, now]
    );

    // Create active rule: No work after 21:00
    await PersonalModelService.createRule({
      user_id: userId,
      statement: 'No work or meetings after 21:00',
      scope: 'HEALTH',
      priority: 1
    });

    // Create test outcome
    testOutcome = await PersonalModelService.createOutcome({
      user_id: userId,
      title: 'Ship Orion Phase 4 Calendar Engine',
      description: 'Implement local-first calendar adapter, availability calculation, and schedule-aware planning',
      desired_result: 'Orion can plan using real calendar constraints with zero false availability.'
    });

    // Initialize current state
    await PersonalModelService.updateCurrentState(userId, {
      current_focus: 'Phase 4 Calendar Verification',
      available_time_window: 120
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
    await db.run('DELETE FROM calendar_events WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM outcomes WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM rules WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM current_state WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await closeDb();
  });

  // ─── 1. Calendar Adapter CRUD ──────────────────────────────────────────────
  describe('1. Calendar Adapter SQLite CRUD & Fixtures', () => {
    let createdEventId: string;

    it('creates a new calendar event in SQLite', async () => {
      const event = await calendarAdapter.createEvent(userId, {
        title: 'Morning Focus Session',
        start_time: `${testDateStr}T09:00:00.000Z`,
        end_time: `${testDateStr}T10:30:00.000Z`,
        is_all_day: false,
        description: 'Writing Phase 4 tests',
        location: 'Lab',
        source: 'LOCAL'
      });

      assert.ok(event.id);
      assert.strictEqual(event.user_id, userId);
      assert.strictEqual(event.title, 'Morning Focus Session');
      assert.strictEqual(event.is_all_day, false);
      assert.strictEqual(event.source, 'LOCAL');
      createdEventId = event.id;
    });

    it('retrieves event by ID', async () => {
      const event = await calendarAdapter.getEventById(userId, createdEventId);
      assert.ok(event);
      assert.strictEqual(event?.id, createdEventId);
      assert.strictEqual(event?.title, 'Morning Focus Session');
    });

    it('filters events by date range overlap', async () => {
      // Create second event in afternoon
      await calendarAdapter.createEvent(userId, {
        title: 'Afternoon Architecture Review',
        start_time: `${testDateStr}T14:00:00.000Z`,
        end_time: `${testDateStr}T15:00:00.000Z`,
        is_all_day: false
      });

      const morningEvents = await calendarAdapter.getEvents(
        userId,
        `${testDateStr}T08:00:00.000Z`,
        `${testDateStr}T11:00:00.000Z`
      );
      assert.strictEqual(morningEvents.length, 1);
      assert.strictEqual(morningEvents[0].title, 'Morning Focus Session');

      const allDayEvents = await calendarAdapter.getEvents(
        userId,
        `${testDateStr}T00:00:00.000Z`,
        `${testDateStr}T23:59:59.000Z`
      );
      assert.strictEqual(allDayEvents.length, 2);
    });

    it('updates existing event fields', async () => {
      const updated = await calendarAdapter.updateEvent(userId, createdEventId, {
        title: 'Extended Morning Focus Session',
        location: 'Home Office'
      });

      assert.strictEqual(updated.title, 'Extended Morning Focus Session');
      assert.strictEqual(updated.location, 'Home Office');
    });

    it('deletes event by ID', async () => {
      const deleted = await calendarAdapter.deleteEvent(userId, createdEventId);
      assert.strictEqual(deleted, true);

      const check = await calendarAdapter.getEventById(userId, createdEventId);
      assert.strictEqual(check, null);
    });

    it('seeds realistic fixtures matching Build Spec golden day', async () => {
      await calendarAdapter.clearEvents(userId);
      const seeded = await calendarAdapter.seedRealisticFixtures(userId, new Date(`${testDateStr}T12:00:00.000Z`));
      assert.ok(seeded.length >= 4, 'Must seed at least 4 realistic daily events');

      const events = await calendarAdapter.getEvents(userId);
      assert.strictEqual(events.length, seeded.length);
      assert.ok(events.some((e) => e.title.includes('Standup')));
      assert.ok(events.some((e) => e.title.includes('Lunch')));
    });
  });

  // ─── 2. Availability Calculation Engine ────────────────────────────────────
  describe('2. Availability Calculation & Deep Work Detection', () => {
    before(async () => {
      // Clear and setup deterministic day schedule
      await calendarAdapter.clearEvents(userId);
      // Event 1: Standup 09:30 - 10:00 (30m)
      await calendarAdapter.createEvent(userId, {
        title: 'Team Standup',
        start_time: `${testDateStr}T09:30:00.000Z`,
        end_time: `${testDateStr}T10:00:00.000Z`,
        is_all_day: false
      });
      // Event 2: Strategy Review 11:30 - 12:30 (60m)
      await calendarAdapter.createEvent(userId, {
        title: 'Strategy Review',
        start_time: `${testDateStr}T11:30:00.000Z`,
        end_time: `${testDateStr}T12:30:00.000Z`,
        is_all_day: false
      });
      // Event 3: Lunch 12:30 - 13:30 (60m)
      await calendarAdapter.createEvent(userId, {
        title: 'Lunch Break',
        start_time: `${testDateStr}T12:30:00.000Z`,
        end_time: `${testDateStr}T13:30:00.000Z`,
        is_all_day: false
      });
      // Event 4: Sync 16:30 - 17:30 (60m)
      await calendarAdapter.createEvent(userId, {
        title: 'Team Sync',
        start_time: `${testDateStr}T16:30:00.000Z`,
        end_time: `${testDateStr}T17:30:00.000Z`,
        is_all_day: false
      });
    });

    it('computes free windows and deep work slots accurately', async () => {
      const availability = await availabilityEngine.calculateAvailability(userId, testDateStr, {
        dayStartHour: 9,
        dayEndHour: 21,
        deepWorkThreshold: 90
      });

      assert.strictEqual(availability.date, testDateStr);
      assert.ok(availability.freeWindows.length >= 3, 'Must compute inverted free windows');

      // Check afternoon focus window: 13:30 - 16:30 = 180 min uninterrupted
      const afternoonWindow = availability.freeWindows.find(
        (w) => w.durationMinutes === 180
      );
      assert.ok(afternoonWindow, 'Must detect 180-minute afternoon window');
      assert.strictEqual(afternoonWindow?.isDeepWork, true, '>= 90m window must be classified as deep work');

      // Check morning window: 09:00 - 09:30 = 30 min (not deep work)
      const earlyWindow = availability.freeWindows.find((w) => w.durationMinutes === 30);
      assert.ok(earlyWindow);
      assert.strictEqual(earlyWindow?.isDeepWork, false);

      // Check evening window: 17:30 - 21:00 = 210 min
      const eveningWindow = availability.freeWindows.find((w) => w.durationMinutes === 210);
      assert.ok(eveningWindow);
      assert.strictEqual(eveningWindow?.isDeepWork, true);

      // Total free minutes = 30 + 90 (10:00-11:30) + 180 + 210 = 510m
      assert.strictEqual(availability.totalFreeMinutes, 510);
      // Deep work minutes = 180 + 210 = 390m (or 90m if 10:00-11:30 also counts)
      // 10:00 - 11:30 is exactly 90m, which satisfies >= 90m!
      // So deep work minutes = 90 + 180 + 210 = 480m
      assert.strictEqual(availability.deepWorkMinutes, 480);
    });

    it('updates current_state available_time_window dynamically', async () => {
      await availabilityEngine.calculateAvailability(userId, testDateStr);
      const state = await PersonalModelService.getCurrentState(userId);
      assert.strictEqual(state?.available_time_window, 510);
    });
  });

  // ─── 3. Rule Enforcement in Availability ───────────────────────────────────
  describe('3. Rule Enforcement against Calendar Events', () => {
    it('detects and flags rule violation when meeting is booked past 21:00', async () => {
      // Add a late evening meeting past the user rule "No work or meetings after 21:00"
      await calendarAdapter.createEvent(userId, {
        title: 'Emergency Late Night Meeting',
        start_time: `${testDateStr}T21:30:00.000Z`,
        end_time: `${testDateStr}T22:30:00.000Z`,
        is_all_day: false
      });

      const availability = await availabilityEngine.calculateAvailability(userId, testDateStr, {
        dayStartHour: 9,
        dayEndHour: 23
      });

      assert.ok(availability.ruleViolations, 'Must detect rule violations');
      assert.ok(availability.ruleViolations.length > 0);
      assert.ok(
        availability.ruleViolations.some((v) =>
          v.rule.includes('after 21:00') && v.event.includes('Emergency Late Night Meeting')
        ),
        'Must identify specific event and violated rule'
      );
    });
  });

  // ─── 4. Schedule-Aware Planning ───────────────────────────────────────────
  describe('4. Schedule-Aware Outcome Planning', () => {
    it('slots schedule block directly into verified free calendar window', async () => {
      const plan = await PlanningService.generateScheduleAwarePlan(
        userId,
        testOutcome,
        testDateStr
      );

      assert.ok(plan);
      assert.strictEqual(plan.outcomeId, testOutcome.id);
      assert.ok(plan.schedule.length > 0);

      // Verify block is slotted into a genuine free window, not colliding with meetings
      const block = plan.schedule[0];
      const events = await calendarAdapter.getEvents(userId);

      for (const ev of events) {
        const evStart = new Date(ev.start_time).getTime();
        const evEnd = new Date(ev.end_time).getTime();
        const blockStart = new Date(block.startTime).getTime();
        const blockEnd = new Date(block.endTime).getTime();

        const collision = evStart < blockEnd && evEnd > blockStart;
        assert.strictEqual(
          collision,
          false,
          `Schedule block "${block.title}" must not collide with event "${ev.title}"`
        );
      }

      assert.ok(
        plan.reviewConditions.some((rc) => rc.action.includes('PlanInvalidationService')),
        'Must register review condition for calendar collision detection'
      );
    });

    it('attaches critical blocker when required effort exceeds free capacity', () => {
      const limitedCalendar = {
        events: [],
        availableWindowsMinutes: [30],
        availability: {
          date: testDateStr,
          totalFreeMinutes: 30, // only 30m free
          deepWorkMinutes: 0,
          busyIntervals: [],
          freeWindows: [
            {
              start: `${testDateStr}T10:00:00.000Z`,
              end: `${testDateStr}T10:30:00.000Z`,
              durationMinutes: 30,
              isDeepWork: false
            }
          ]
        }
      };

      const plan = PlanningService.generatePlan({
        outcome: testOutcome,
        currentState: { available_time_window: 30 },
        context: {
          intent: 'Planning',
          desiredOutcome: testOutcome.title,
          currentState: { user_id: userId, available_time_window: 30, active_constraints: [], recent_events: [], last_updated_at: '' },
          goals: [],
          outcomes: [testOutcome],
          projects: [],
          commitments: [],
          rules: [],
          decisions: [],
          conflicts: [],
          uncertainties: []
        },
        calendar: limitedCalendar
      });

      const capacityBlocker = plan.blockers.find((b) => b.severity === 'critical');
      assert.ok(capacityBlocker, 'Must attach critical blocker for capacity deficit');
      assert.ok(capacityBlocker?.description.includes('Capacity constraint'));
      assert.ok(
        plan.assumptions.some((a) => a.statement.includes('Requires extending deadline')),
        'Must record explicit assumption about deadline/commitment adjustment'
      );
    });
  });

  // ─── 5. Plan Invalidation Service ──────────────────────────────────────────
  describe('5. Plan Invalidation Engine', () => {
    it('detects collision when an urgent calendar event overlaps with planned schedule block', () => {
      const plan: Plan = {
        outcomeId: testOutcome.id,
        rationale: 'Execute milestone',
        milestones: [{ id: 'm1', title: 'Task 1', order: 1, completed: false }],
        schedule: [
          {
            id: 'sb_1',
            title: 'Deep focus: Milestone 1',
            startTime: `${testDateStr}T14:00:00.000Z`,
            endTime: `${testDateStr}T15:30:00.000Z`,
            durationMinutes: 90
          }
        ],
        dependencies: [],
        blockers: [],
        assumptions: [],
        reviewConditions: []
      };

      // Conflicting event booked during focus block
      const events: CalendarEvent[] = [
        {
          id: 'ev_conflict',
          user_id: userId,
          title: 'Urgent Client Escalation Call',
          start_time: `${testDateStr}T14:30:00.000Z`,
          end_time: `${testDateStr}T15:00:00.000Z`,
          is_all_day: false
        }
      ];

      const validation = planInvalidationService.validatePlanAgainstCalendar(plan, events);
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.status, 'COLLISION');
      assert.strictEqual(validation.recommendedAction, 'REPLAN');
      assert.ok(validation.reason?.includes('Urgent Client Escalation Call'));
      assert.strictEqual(validation.conflictingEvents?.length, 1);
    });

    it('detects deadline jeopardy when schedule block exceeds deadline', () => {
      const plan: Plan = {
        outcomeId: testOutcome.id,
        rationale: 'Execute milestone',
        milestones: [{ id: 'm1', title: 'Task 1', order: 1, completed: false }],
        schedule: [
          {
            id: 'sb_late',
            title: 'Late task',
            startTime: `${testDateStr}T16:00:00.000Z`,
            endTime: `${testDateStr}T18:00:00.000Z`,
            durationMinutes: 120
          }
        ],
        dependencies: [],
        blockers: [],
        assumptions: [],
        reviewConditions: []
      };

      const validation = planInvalidationService.validatePlanAgainstCalendar(plan, [], {
        deadline: `${testDateStr}T17:00:00.000Z`
      });

      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.status, 'DEADLINE_JEOPARDY');
      assert.strictEqual(validation.recommendedAction, 'NOTIFY_USER');
      assert.ok(validation.reason?.includes('exceeds deadline'));
    });

    it('detects capacity exceeded when total planned time exceeds available free minutes', () => {
      const plan: Plan = {
        outcomeId: testOutcome.id,
        rationale: 'Execute milestone',
        milestones: [{ id: 'm1', title: 'Task 1', order: 1, completed: false }],
        schedule: [
          {
            id: 'sb_1',
            title: 'Task A',
            startTime: `${testDateStr}T10:00:00.000Z`,
            endTime: `${testDateStr}T12:00:00.000Z`,
            durationMinutes: 120
          }
        ],
        dependencies: [],
        blockers: [],
        assumptions: [],
        reviewConditions: []
      };

      const validation = planInvalidationService.validatePlanAgainstCalendar(plan, [], {
        availableFreeMinutes: 60
      });

      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.status, 'CAPACITY_EXCEEDED');
      assert.strictEqual(validation.recommendedAction, 'REPLAN');
    });

    it('returns VALID when there are no collisions, deadlines are met, and capacity suffices', () => {
      const plan: Plan = {
        outcomeId: testOutcome.id,
        rationale: 'Execute milestone',
        milestones: [{ id: 'm1', title: 'Task 1', order: 1, completed: false }],
        schedule: [
          {
            id: 'sb_valid',
            title: 'Focus task',
            startTime: `${testDateStr}T14:00:00.000Z`,
            endTime: `${testDateStr}T15:00:00.000Z`,
            durationMinutes: 60
          }
        ],
        dependencies: [],
        blockers: [],
        assumptions: [],
        reviewConditions: []
      };

      const events: CalendarEvent[] = [
        {
          id: 'ev_other',
          user_id: userId,
          title: 'Morning Meeting',
          start_time: `${testDateStr}T09:00:00.000Z`,
          end_time: `${testDateStr}T10:00:00.000Z`,
          is_all_day: false
        }
      ];

      const validation = planInvalidationService.validatePlanAgainstCalendar(plan, events, {
        deadline: `${testDateStr}T18:00:00.000Z`,
        availableFreeMinutes: 180
      });

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.status, 'VALID');
      assert.strictEqual(validation.recommendedAction, 'NONE');
    });
  });

  // ─── 6. HTTP REST API Endpoints ────────────────────────────────────────────
  describe('6. Calendar REST API Endpoints', () => {
    async function request(options: {
      method: string;
      path: string;
      body?: any;
    }): Promise<{ status: number; data: any }> {
      return new Promise((resolve, reject) => {
        const postData = options.body ? JSON.stringify(options.body) : '';
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: options.path,
            method: options.method,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve({ status: res.statusCode || 200, data: parsed });
              } catch {
                resolve({ status: res.statusCode || 200, data: body });
              }
            });
          }
        );
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
      });
    }

    let httpCreatedEventId: string;

    it('POST /api/calendar/events creates an event via HTTP', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/calendar/events',
        body: {
          user_id: userId,
          title: 'HTTP Created Standup',
          start_time: `${testDateStr}T10:00:00.000Z`,
          end_time: `${testDateStr}T10:30:00.000Z`,
          location: 'Lab Room 1'
        }
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.event.title, 'HTTP Created Standup');
      httpCreatedEventId = res.data.event.id;
    });

    it('GET /api/calendar/events lists events via HTTP', async () => {
      const res = await request({
        method: 'GET',
        path: `/api/calendar/events?userId=${userId}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.events));
      assert.ok(res.data.events.some((e: any) => e.id === httpCreatedEventId));
    });

    it('GET /api/calendar/events/:id fetches single event via HTTP', async () => {
      const res = await request({
        method: 'GET',
        path: `/api/calendar/events/${httpCreatedEventId}?userId=${userId}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.event.id, httpCreatedEventId);
    });

    it('PUT /api/calendar/events/:id updates event via HTTP', async () => {
      const res = await request({
        method: 'PUT',
        path: `/api/calendar/events/${httpCreatedEventId}`,
        body: {
          user_id: userId,
          title: 'HTTP Renamed Standup'
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.event.title, 'HTTP Renamed Standup');
    });

    it('GET /api/calendar/availability computes availability via HTTP', async () => {
      const res = await request({
        method: 'GET',
        path: `/api/calendar/availability?userId=${userId}&date=${testDateStr}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.availability);
      assert.ok(res.data.availability.totalFreeMinutes > 0);
      assert.ok(Array.isArray(res.data.availability.freeWindows));
    });

    it('POST /api/calendar/plan generates schedule-aware plan via HTTP', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/calendar/plan',
        body: {
          user_id: userId,
          outcomeId: testOutcome.id,
          targetDate: testDateStr
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.plan);
      assert.strictEqual(res.data.plan.outcomeId, testOutcome.id);
      assert.ok(res.data.plan.schedule.length > 0);
    });

    it('POST /api/calendar/validate-plan validates plan via HTTP', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/calendar/validate-plan',
        body: {
          user_id: userId,
          plan: {
            outcomeId: testOutcome.id,
            rationale: 'Valid test plan',
            milestones: [],
            schedule: [
              {
                id: 'sb_http',
                title: 'HTTP Scheduled Block',
                startTime: `${testDateStr}T14:00:00.000Z`,
                endTime: `${testDateStr}T15:00:00.000Z`,
                durationMinutes: 60
              }
            ],
            dependencies: [],
            blockers: [],
            assumptions: [],
            reviewConditions: []
          }
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.validation);
      assert.strictEqual(typeof res.data.validation.valid, 'boolean');
    });

    it('DELETE /api/calendar/events/:id removes event via HTTP', async () => {
      const res = await request({
        method: 'DELETE',
        path: `/api/calendar/events/${httpCreatedEventId}?userId=${userId}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.deleted, true);
    });

    it('POST /api/calendar/seed-fixtures seeds golden fixtures via HTTP', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/calendar/seed-fixtures',
        body: {
          user_id: userId,
          baseDate: `${testDateStr}T12:00:00.000Z`
        }
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.seededCount >= 4);
    });
  });
});
