import { Router, Request, Response } from 'express';
import { PermissionService } from '../services/agency/permissionService';
import { ActionStateMachine } from '../services/agency/actionStateMachine';
import { toolRouter } from '../services/agency/toolRouter';
import type { ActionStatus } from '@orion/types';

export const agencyRouter = Router();

const DEFAULT_USER_ID = 'user_ben';

// ─── 1. Permissions API ──────────────────────────────────────────────────────
agencyRouter.get('/permissions', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const tool = req.query.tool as string | undefined;
    const status = req.query.status as string | undefined;

    const permissions = await PermissionService.listPermissions(userId, { tool, status });
    res.json({ success: true, permissions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to list permissions' });
  }
});

agencyRouter.post('/permissions', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const { tool, capability, scope, risk_level, mode, conditions, expires_at } = req.body;

    if (!tool || !capability) {
      return res.status(400).json({ success: false, error: 'tool and capability are required' });
    }

    const permission = await PermissionService.grantPermission({
      user_id: userId,
      tool,
      capability,
      scope,
      risk_level,
      mode,
      conditions,
      expires_at
    });

    res.status(201).json({ success: true, permission });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to grant permission' });
  }
});

agencyRouter.delete('/permissions/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || req.body.user_id || DEFAULT_USER_ID;
    const revoked = await PermissionService.revokePermission(userId, req.params.id);

    if (!revoked) {
      return res.status(404).json({ success: false, error: 'Permission not found or already revoked' });
    }
    res.json({ success: true, revoked: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to revoke permission' });
  }
});

// ─── 2. Tools & Capabilities Catalog ─────────────────────────────────────────
agencyRouter.get('/tools', async (_req: Request, res: Response) => {
  try {
    const capabilities = toolRouter.listCapabilities();
    res.json({ success: true, capabilities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to list tools' });
  }
});

// ─── 3. Actions API ──────────────────────────────────────────────────────────
agencyRouter.get('/actions', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const status = req.query.status as ActionStatus | undefined;

    const actions = await ActionStateMachine.listActions(userId, status);
    res.json({ success: true, actions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to list actions' });
  }
});

agencyRouter.get('/actions/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const action = await ActionStateMachine.getAction(userId, req.params.id);

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }
    res.json({ success: true, action });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to get action' });
  }
});

agencyRouter.post('/actions', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const { description, tool, capability, payload, outcomeId, actor, riskLevel } = req.body;

    if (!description) {
      return res.status(400).json({ success: false, error: 'description is required' });
    }

    const action = await ActionStateMachine.proposeAction(userId, {
      description,
      tool,
      capability,
      payload,
      outcomeId,
      actor,
      riskLevel
    });

    res.status(201).json({ success: true, action });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to propose action' });
  }
});

agencyRouter.post('/actions/:id/approve', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const result = await ActionStateMachine.approveAction(userId, req.params.id);

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to approve action' });
  }
});

agencyRouter.post('/actions/:id/reject', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const { reason } = req.body;

    const action = await ActionStateMachine.rejectAction(userId, req.params.id, reason);
    res.json({ success: true, action });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to reject action' });
  }
});

agencyRouter.post('/actions/:id/execute', async (req: Request, res: Response) => {
  try {
    const userId = req.body.user_id || (req.query.userId as string) || DEFAULT_USER_ID;
    const result = await ActionStateMachine.executeAction(userId, req.params.id);

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to execute action' });
  }
});
