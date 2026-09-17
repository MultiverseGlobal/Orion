process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDb, closeDb } from '../db';
import { ActionStateMachine } from '../services/agency/actionStateMachine';
import { CalendarTool, toolRouter } from '../services/agency/toolRouter';
import { PersonalModelService } from '../services/personalModel/personalModelService';
import type { Action, HomeOrientation, ToolResult, VerificationResult } from '@orion/types';

describe('Orion Build Spec V1 — Phase 6 Home UX, Approval & Action Centre', () => {
  const userId = 'user_ben_phase6';
  let server: http.Server;
  let app: any;
  const testPort = 3012;

  before(async () => {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, display_name, timezone, locale, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Ben (Phase 6 Test)', 'Europe/London', 'en-GB', '{}', now, now]
    );

    await PersonalModelService.updateCurrentState(userId, {
      current_focus: 'Orion Phase 6 Home Testing',
      available_time_window: 60
    });

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
    await db.run('DELETE FROM actions WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM calendar_events WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM current_state WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await closeDb();
  });

  async function fetchOrientation(): Promise<HomeOrientation> {
    const res = await fetch(`http://localhost:${testPort}/api/home/orientation?userId=${userId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    return data as HomeOrientation;
  }

  it('Silent Baseline: orbState is breathing and no proactive speech when idle', async () => {
    const orientation = await fetchOrientation();
    assert.strictEqual(orientation.orbState, 'breathing');
    assert.strictEqual(orientation.proactiveSpeech, null);
    assert.strictEqual(orientation.pendingApprovals.length, 0);
    assert.strictEqual(orientation.focusContext?.currentActivity, undefined);
  });

  it('Proactivity Trigger: Staging a HIGH-risk action triggers needs_you state and speech', async () => {
    // Stage a high risk action
    const action = await ActionStateMachine.proposeAction(userId, {
      description: 'Delete important event',
      tool: 'calendar',
      capability: 'delete_event',
      payload: { id: 'evt_123' },
      riskLevel: 'HIGH'
    });
    
    // Simulate it pausing at WAITING_APPROVAL (we skip permission check for test by explicitly updating)
    const db = await getDb();
    await db.run('UPDATE actions SET status = ? WHERE id = ?', ['WAITING_APPROVAL', action.id]);

    const orientation = await fetchOrientation();
    assert.strictEqual(orientation.orbState, 'needs_you');
    assert.strictEqual(orientation.pendingApprovals.length, 1);
    
    // Check projection
    const item = orientation.pendingApprovals[0];
    assert.strictEqual(item.what, 'Delete important event');
    assert.strictEqual(item.riskLevel, 'CRITICAL'); // mapped from HIGH + irreversible
    assert.strictEqual(item.supportsRollback, false);
    
    assert.ok(orientation.proactiveSpeech);
    assert.strictEqual(orientation.proactiveSpeech.reason, 'staged_urgent_approval');
  });

  it('Rejection: Rejecting the action transitions it to CANCELLED', async () => {
    // Get the pending action
    const orientationBefore = await fetchOrientation();
    const actionId = orientationBefore.pendingApprovals[0].id;

    const res = await fetch(`http://localhost:${testPort}/api/home/action/${actionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, reason: 'Decided not to' })
    });
    assert.strictEqual(res.status, 200);

    const action = await ActionStateMachine.getAction(userId, actionId);
    assert.strictEqual(action?.status, 'CANCELLED');
    assert.ok(action?.error?.includes('Decided not to'));

    const orientationAfter = await fetchOrientation();
    assert.strictEqual(orientationAfter.orbState, 'breathing');
    assert.strictEqual(orientationAfter.pendingApprovals.length, 0);
  });

  it('Approval Lifecycle: Approving advances WAITING_APPROVAL -> EXECUTING -> VERIFYING -> COMPLETED', async () => {
    // Stage a new action
    const action = await ActionStateMachine.proposeAction(userId, {
      description: 'Create test event',
      tool: 'calendar',
      capability: 'create_event',
      payload: { title: 'Test Event', start_time: new Date().toISOString(), end_time: new Date().toISOString() },
      riskLevel: 'MEDIUM' // So it might need approval depending on perms, we force it
    });
    const db = await getDb();
    await db.run('UPDATE actions SET status = ? WHERE id = ?', ['WAITING_APPROVAL', action.id]);

    // Approve it
    const res = await fetch(`http://localhost:${testPort}/api/home/action/${action.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    assert.strictEqual(res.status, 200);
    const data: any = await res.json();
    assert.strictEqual(data.success, true);
    
    // actionStateMachine returns the final state (COMPLETED if verified)
    assert.strictEqual(data.action.status, 'COMPLETED');
    assert.strictEqual(data.verification.verified, true);
  });

  it('Verification Integrity: Verification failure marks action as FAILED', async () => {
    // Register a failing tool temporarily
    class FailingTool extends CalendarTool {
      async verify(_cap: string, _res: ToolResult): Promise<VerificationResult> {
        return { verified: false, details: 'Intentional verification failure', timestamp: new Date().toISOString() };
      }
    }
    const originalTool = toolRouter.getTool('calendar');
    toolRouter.registerTool(new FailingTool());

    const action = await ActionStateMachine.proposeAction(userId, {
      description: 'Create test event 2',
      tool: 'calendar',
      capability: 'create_event',
      payload: { title: 'Test Event 2', start_time: new Date().toISOString(), end_time: new Date().toISOString() },
      riskLevel: 'MEDIUM'
    });
    const db = await getDb();
    await db.run('UPDATE actions SET status = ? WHERE id = ?', ['WAITING_APPROVAL', action.id]);

    const res = await fetch(`http://localhost:${testPort}/api/home/action/${action.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    
    const data: any = await res.json();
    assert.strictEqual(data.success, true); // The HTTP call succeeded
    assert.strictEqual(data.action.status, 'FAILED');
    assert.ok(data.action.error.includes('Intentional verification failure'));

    // Restore original tool
    if (originalTool) toolRouter.registerTool(originalTool);
  });
});
