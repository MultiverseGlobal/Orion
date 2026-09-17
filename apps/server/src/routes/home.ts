import { Router, Request, Response } from 'express';
import { HomeService } from '../services/home/homeService';

export const homeRouter = Router();

const DEFAULT_USER_ID = 'user_ben';

// ─── 1. Orientation (Polled by Frontend) ──────────────────────────────────────

homeRouter.get('/orientation', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const orientation = await HomeService.getOrientation(userId);
    res.json({ success: true, ...orientation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to get orientation' });
  }
});

// ─── 2. Approve Action (Verification Pipeline) ───────────────────────────────

homeRouter.post('/action/:id/approve', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const result = await HomeService.approveAction(userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to approve action' });
  }
});

// ─── 3. Reject/Cancel Action ──────────────────────────────────────────────────

homeRouter.post('/action/:id/reject', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const { reason } = req.body;
    const action = await HomeService.rejectAction(userId, req.params.id, reason);
    res.json({ success: true, action });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to reject action' });
  }
});
