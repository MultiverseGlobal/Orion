import { Router, Request, Response } from 'express';
import { PersonalModelService } from '../services/personalModel/personalModelService';

export const personalModelRouter = Router();

const DEFAULT_USER_ID = 'user_ben';

// ─── 1. Overview ─────────────────────────────────────────────────────────────
personalModelRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const overview = await PersonalModelService.getOverview(userId);
    res.json({ success: true, data: overview });
  } catch (error: any) {
    console.error('[API] Error fetching personal model overview:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch overview' });
  }
});

// ─── 2. Goals ────────────────────────────────────────────────────────────────
personalModelRouter.get('/goals', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = (req.query.status as string) || 'ACTIVE';
    const goals = await PersonalModelService.getGoals(userId, status);
    res.json({ success: true, data: goals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/goals', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const goal = await PersonalModelService.createGoal({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: goal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 3. Projects ─────────────────────────────────────────────────────────────
personalModelRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = (req.query.status as string) || 'ACTIVE';
    const projects = await PersonalModelService.getProjects(userId, status);
    res.json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const project = await PersonalModelService.createProject({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 4. Outcomes ─────────────────────────────────────────────────────────────
personalModelRouter.get('/outcomes', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = req.query.status as string | undefined;
    const outcomes = await PersonalModelService.getOutcomes(userId, status);
    res.json({ success: true, data: outcomes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/outcomes', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const outcome = await PersonalModelService.createOutcome({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: outcome });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.patch('/outcomes/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    await PersonalModelService.updateOutcomeStatus(id, status);
    res.json({ success: true, message: `Outcome ${id} updated to ${status}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 5. Commitments ──────────────────────────────────────────────────────────
personalModelRouter.get('/commitments', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = (req.query.status as string) || 'PENDING';
    const commitments = await PersonalModelService.getCommitments(userId, status);
    res.json({ success: true, data: commitments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/commitments', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const commitment = await PersonalModelService.createCommitment({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: commitment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 6. Rules ────────────────────────────────────────────────────────────────
personalModelRouter.get('/rules', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = (req.query.status as string) || 'ACTIVE';
    const rules = await PersonalModelService.getRules(userId, status);
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/rules', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const rule = await PersonalModelService.createRule({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 7. Preferences ──────────────────────────────────────────────────────────
personalModelRouter.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = (req.query.status as string) || 'ACTIVE';
    const prefs = await PersonalModelService.getPreferences(userId, status);
    res.json({ success: true, data: prefs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const pref = await PersonalModelService.createPreference({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: pref });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 8. Decisions (with Supersession) ─────────────────────────────────────────
personalModelRouter.get('/decisions', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = (req.query.status as string) || 'ACTIVE';
    const decisions = await PersonalModelService.getDecisions(userId, status);
    res.json({ success: true, data: decisions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/decisions', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const decision = await PersonalModelService.recordDecision({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: decision });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 9. Patterns ─────────────────────────────────────────────────────────────
personalModelRouter.get('/patterns', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = (req.query.status as string) || 'ACTIVE';
    const patterns = await PersonalModelService.getPatterns(userId, status);
    res.json({ success: true, data: patterns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/patterns', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const pattern = await PersonalModelService.recordPattern({ ...req.body, user_id: userId });
    res.status(201).json({ success: true, data: pattern });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 10. Current State ───────────────────────────────────────────────────────
personalModelRouter.get('/current-state', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const state = await PersonalModelService.getCurrentState(userId);
    res.json({ success: true, data: state });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

personalModelRouter.post('/current-state', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const state = await PersonalModelService.updateCurrentState(userId, req.body);
    res.json({ success: true, data: state });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
