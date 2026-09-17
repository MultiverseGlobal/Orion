/**
 * Orion Build Spec V1 — Memory & Classification REST Routes
 *
 * Exposes:
 * POST /api/memory/classify — Classify candidate statement into memory type
 * POST /api/memory/promote — Ingest and promote candidate into Personal Model / Deep Memory
 * POST /api/memory/search — Deep memory search across local & Metaphor
 * POST /api/memory/forget — Forget/purge entity from active retrieval pathways
 * POST /api/memory/supersede — Supersede an older record with a newer one
 */

import { Router, Request, Response } from 'express';
import { MemoryClassifierService } from '../services/memory/memoryClassifier';
import { MemoryPromotionPipeline } from '../services/memory/memoryPromotionPipeline';
import { MemoryLifecycleService, LifecycleTable } from '../services/memory/memoryLifecycleService';
import { MetaphorAdapter } from '../services/memory/metaphorAdapter';

export const memoryRouter = Router();
const metaphor = new MetaphorAdapter();

// POST /api/memory/classify
memoryRouter.post('/classify', (req: Request, res: Response) => {
  try {
    const text = req.body.text;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const classified = MemoryClassifierService.classify({
      text,
      source: req.body.source || 'USER_EXPLICIT'
    });

    res.json({ success: true, data: classified });
  } catch (error: any) {
    console.error('Error in /api/memory/classify:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/memory/promote
memoryRouter.post('/promote', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_ben';
    const text = req.body.text;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const result = await MemoryPromotionPipeline.ingestAndPromote(userId, {
      text,
      source: req.body.source || 'USER_EXPLICIT'
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in /api/memory/promote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/memory/search
memoryRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const query = req.body.query;
    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const results = await metaphor.search({
      query,
      limit: req.body.limit || 10
    });

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Error in /api/memory/search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/memory/forget
memoryRouter.post('/forget', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_ben';
    const { table, id } = req.body;

    if (!table || !id) {
      return res.status(400).json({ success: false, error: 'table and id are required' });
    }

    const success = await MemoryLifecycleService.forget(table as LifecycleTable, id, userId);
    res.json({
      success,
      message: success
        ? `Entity ${id} forgotten from ${table}. Removed from all active retrieval pathways.`
        : `Entity ${id} not found in ${table}.`
    });
  } catch (error: any) {
    console.error('Error in /api/memory/forget:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/memory/supersede
memoryRouter.post('/supersede', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 'user_ben';
    const { table, oldId, newId } = req.body;

    if (!table || !oldId || !newId) {
      return res.status(400).json({ success: false, error: 'table, oldId, and newId are required' });
    }

    const success = await MemoryLifecycleService.supersede(table as LifecycleTable, oldId, newId, userId);
    res.json({ success, message: `Entity ${oldId} superseded by ${newId}` });
  } catch (error: any) {
    console.error('Error in /api/memory/supersede:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
