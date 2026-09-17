/**
 * Orion Build Spec V1 — Cognitive Core REST Routes
 *
 * Exposes:
 * POST /api/cognitive/interact — Main cognitive interaction endpoint
 * POST /api/cognitive/context — Generate & inspect ContextPack
 * POST /api/cognitive/plan — Generate Plan for an outcome
 */

import { Router, Request, Response } from 'express';
import { OrionCoreService } from '../services/cognitive/orionCore';
import { ContextEngineService } from '../services/cognitive/contextEngine';
import { PlanningService } from '../services/cognitive/planningEngine';
import { PersonalModelService } from '../services/personalModel/personalModelService';
import { OrionRequest, ContextRequest, Outcome } from '@orion/types';

export const cognitiveRouter = Router();

// POST /api/cognitive/interact
cognitiveRouter.post('/interact', async (req: Request, res: Response) => {
  try {
    const payload: OrionRequest = {
      userId: req.body.userId || 'user_ben',
      message: req.body.message,
      surface: req.body.surface || 'chat',
      selectedContent: req.body.selectedContent
    };

    const result = await OrionCoreService.processRequest(payload);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in /api/cognitive/interact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/cognitive/context
cognitiveRouter.post('/context', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_ben';
    const message = req.body.message || '';
    const intent = req.body.intent || ContextEngineService.classifyIntent(message);

    const contextRequest: ContextRequest = {
      userId,
      intent,
      request: message,
      currentEntityIds: req.body.currentEntityIds,
      freshnessRequirement: req.body.freshnessRequirement || 'normal'
    };

    const contextPack = await ContextEngineService.buildContextPack(contextRequest);
    res.json({ success: true, data: contextPack });
  } catch (error: any) {
    console.error('Error in /api/cognitive/context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/cognitive/plan
cognitiveRouter.post('/plan', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_ben';
    const outcomeId = req.body.outcomeId;

    if (!outcomeId) {
      return res.status(400).json({ success: false, error: 'outcomeId is required' });
    }

    const [allOutcomes, currentState] = await Promise.all([
      PersonalModelService.getOutcomes(userId),
      PersonalModelService.getCurrentState(userId)
    ]);

    const outcome = allOutcomes.find((o: Outcome) => o.id === outcomeId);
    if (!outcome) {
      return res.status(404).json({ success: false, error: `Outcome ${outcomeId} not found` });
    }

    const contextPack = await ContextEngineService.buildContextPack({
      userId,
      intent: 'Planning',
      request: `Plan for outcome: ${outcome.title}`
    });

    const plan = PlanningService.generatePlan({
      outcome,
      currentState: currentState || {},
      context: contextPack
    });

    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Error in /api/cognitive/plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
