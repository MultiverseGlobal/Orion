import { Router, Request, Response } from 'express';
import { calendarAdapter } from '../services/calendar/calendarAdapter';
import { availabilityEngine } from '../services/calendar/availabilityEngine';
import { planInvalidationService } from '../services/calendar/planInvalidationService';
import { PlanningService } from '../services/cognitive/planningEngine';
import { PersonalModelService } from '../services/personalModel/personalModelService';
import type { Outcome } from '@orion/types';

export const calendarRouter = Router();

const DEFAULT_USER_ID = 'user_ben';

// ─── 1. List Calendar Events ────────────────────────────────────────────────
calendarRouter.get('/events', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const events = await calendarAdapter.getEvents(userId, startDate, endDate);
    res.json({ success: true, events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to list events' });
  }
});

// ─── 2. Get Single Event ────────────────────────────────────────────────────
calendarRouter.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const event = await calendarAdapter.getEventById(userId, req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    res.json({ success: true, event });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to get event' });
  }
});

// ─── 3. Create Event ────────────────────────────────────────────────────────
calendarRouter.post('/events', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const { title, start_time, end_time, is_all_day, description, location, source } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'title, start_time, and end_time are required'
      });
    }

    const event = await calendarAdapter.createEvent(userId, {
      title,
      start_time,
      end_time,
      is_all_day: Boolean(is_all_day),
      description,
      location,
      source
    });

    res.status(201).json({ success: true, event });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create event' });
  }
});

// ─── 4. Update Event ────────────────────────────────────────────────────────
calendarRouter.put('/events/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const updated = await calendarAdapter.updateEvent(userId, req.params.id, req.body);
    res.json({ success: true, event: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update event' });
  }
});

// ─── 5. Delete Event ────────────────────────────────────────────────────────
calendarRouter.delete('/events/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || req.body.user_id || DEFAULT_USER_ID;
    const deleted = await calendarAdapter.deleteEvent(userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Event not found or already deleted' });
    }
    res.json({ success: true, deleted: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to delete event' });
  }
});

// ─── 6. Query Availability ──────────────────────────────────────────────────
calendarRouter.get('/availability', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const targetDate = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const dayStartHour = req.query.dayStartHour ? parseInt(req.query.dayStartHour as string, 10) : undefined;
    const dayEndHour = req.query.dayEndHour ? parseInt(req.query.dayEndHour as string, 10) : undefined;
    const deepWorkThreshold = req.query.deepWorkThreshold
      ? parseInt(req.query.deepWorkThreshold as string, 10)
      : undefined;
    const bufferMinutes = req.query.bufferMinutes
      ? parseInt(req.query.bufferMinutes as string, 10)
      : undefined;

    const availability = await availabilityEngine.calculateAvailability(userId, targetDate, {
      dayStartHour,
      dayEndHour,
      deepWorkThreshold,
      bufferMinutes
    });

    res.json({ success: true, availability });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to calculate availability' });
  }
});

// ─── 7. Schedule-Aware Plan Generation ──────────────────────────────────────
calendarRouter.post('/plan', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const { outcomeId, outcome: passedOutcome, targetDate } = req.body;

    let targetOutcome: Outcome | null = passedOutcome || null;
    if (!targetOutcome && outcomeId) {
      const outcomes = await PersonalModelService.getOutcomes(userId);
      targetOutcome = outcomes.find((o) => o.id === outcomeId) || null;
    }

    if (!targetOutcome) {
      return res.status(400).json({
        success: false,
        error: 'Either outcomeId (referencing an existing outcome) or an outcome object must be provided'
      });
    }

    const plan = await PlanningService.generateScheduleAwarePlan(userId, targetOutcome, targetDate);
    res.json({ success: true, plan });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate schedule plan' });
  }
});

// ─── 8. Validate Plan Against Calendar ──────────────────────────────────────
calendarRouter.post('/validate-plan', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const { plan, events: passedEvents, deadline, availableFreeMinutes } = req.body;

    if (!plan) {
      return res.status(400).json({ success: false, error: 'plan is required' });
    }

    let events = passedEvents;
    if (!events) {
      // Determine time range from plan schedule
      const firstBlock = plan.schedule?.[0];
      const lastBlock = plan.schedule?.[plan.schedule.length - 1];
      const startRange = firstBlock ? firstBlock.startTime : new Date().toISOString();
      const endRange = lastBlock
        ? lastBlock.endTime
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      events = await calendarAdapter.getEvents(userId, startRange, endRange);
    }

    const validation = planInvalidationService.validatePlanAgainstCalendar(plan, events, {
      deadline,
      availableFreeMinutes
    });

    res.json({ success: true, validation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to validate plan' });
  }
});

// ─── 9. Seed Realistic Fixtures ─────────────────────────────────────────────
calendarRouter.post('/seed-fixtures', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const baseDate = req.body.baseDate ? new Date(req.body.baseDate) : new Date();

    const seeded = await calendarAdapter.seedRealisticFixtures(userId, baseDate);
    res.status(201).json({ success: true, seededCount: seeded.length, events: seeded });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to seed calendar fixtures' });
  }
});
