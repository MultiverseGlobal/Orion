import { calendarAdapter } from '../calendar/calendarAdapter';
import { PersonalModelService } from '../personalModel/personalModelService';
import type {
  OrionTool,
  ToolCapability,
  ToolResult,
  VerificationResult
} from '@orion/types';

// ─── 1. Calendar Tool ────────────────────────────────────────────────────────
export class CalendarTool implements OrionTool {
  name = 'calendar';

  capabilities(): ToolCapability[] {
    return [
      {
        name: 'create_event',
        description: 'Create a calendar event in user schedule',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            start_time: { type: 'string' },
            end_time: { type: 'string' },
            location: { type: 'string' }
          },
          required: ['title', 'start_time', 'end_time']
        },
        riskLevel: 'MEDIUM',
        reversible: true
      },
      {
        name: 'delete_event',
        description: 'Delete a calendar event from user schedule',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        riskLevel: 'HIGH',
        reversible: false
      }
    ];
  }

  async execute(capability: string, input: any): Promise<ToolResult> {
    const userId = input.userId || 'user_ben';

    if (capability === 'create_event') {
      const created = await calendarAdapter.createEvent(userId, {
        title: input.title,
        start_time: input.start_time,
        end_time: input.end_time,
        location: input.location,
        description: input.description,
        is_all_day: Boolean(input.is_all_day)
      });

      return {
        success: true,
        status: 'SUCCESS',
        source: 'calendar',
        data: created,
        createdEntities: [{ type: 'calendar_event', id: created.id }]
      };
    }

    if (capability === 'delete_event') {
      const deleted = await calendarAdapter.deleteEvent(userId, input.id);
      return {
        success: deleted,
        status: deleted ? 'SUCCESS' : 'NOT_FOUND',
        source: 'calendar',
        data: { id: input.id, deleted }
      };
    }

    throw new Error(`Unsupported capability [${capability}] on CalendarTool`);
  }

  async verify(capability: string, result: ToolResult): Promise<VerificationResult> {
    const now = new Date().toISOString();

    if (!result.success) {
      return {
        verified: false,
        details: `Execution reported failure: ${result.error?.message || result.status}`,
        timestamp: now
      };
    }

    const data: any = result.data;
    const userId = data?.user_id || 'user_ben';

    if (capability === 'create_event') {
      const eventId = data?.id;
      if (!eventId) {
        return { verified: false, details: 'Missing event ID in result data', timestamp: now };
      }
      const fetched = await calendarAdapter.getEventById(userId, eventId);
      const verified = Boolean(fetched && fetched.title === data.title);
      return {
        verified,
        details: verified
          ? `Verified calendar event "${fetched?.title}" exists in SQLite.`
          : `Event ${eventId} not found in database during verification check.`,
        timestamp: now
      };
    }

    if (capability === 'delete_event') {
      const eventId = data?.id;
      const fetched = await calendarAdapter.getEventById(userId, eventId);
      const verified = fetched === null;
      return {
        verified,
        details: verified
          ? `Verified calendar event ${eventId} is deleted from SQLite.`
          : `Event ${eventId} still exists in database!`,
        timestamp: now
      };
    }

    return { verified: true, timestamp: now };
  }
}

// ─── 2. Personal Model Tool ──────────────────────────────────────────────────
export class PersonalModelTool implements OrionTool {
  name = 'personal_model';

  capabilities(): ToolCapability[] {
    return [
      {
        name: 'create_outcome',
        description: 'Define a strategic outcome in user personal model',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            desired_result: { type: 'string' }
          },
          required: ['title']
        },
        riskLevel: 'LOW',
        reversible: true
      },
      {
        name: 'create_rule',
        description: 'Establish a new operating rule in user personal model',
        inputSchema: {
          type: 'object',
          properties: {
            statement: { type: 'string' },
            scope: { type: 'string' },
            priority: { type: 'number' }
          },
          required: ['statement']
        },
        riskLevel: 'MEDIUM',
        reversible: true
      }
    ];
  }

  async execute(capability: string, input: any): Promise<ToolResult> {
    const userId = input.userId || 'user_ben';

    if (capability === 'create_outcome') {
      const outcome = await PersonalModelService.createOutcome({
        user_id: userId,
        title: input.title,
        description: input.description,
        desired_result: input.desired_result
      });

      return {
        success: true,
        status: 'SUCCESS',
        source: 'personal_model',
        data: outcome,
        createdEntities: [{ type: 'outcome', id: outcome.id }]
      };
    }

    if (capability === 'create_rule') {
      const rule = await PersonalModelService.createRule({
        user_id: userId,
        statement: input.statement,
        scope: input.scope,
        priority: input.priority
      });

      return {
        success: true,
        status: 'SUCCESS',
        source: 'personal_model',
        data: rule,
        createdEntities: [{ type: 'rule', id: rule.id }]
      };
    }

    throw new Error(`Unsupported capability [${capability}] on PersonalModelTool`);
  }

  async verify(capability: string, result: ToolResult): Promise<VerificationResult> {
    const now = new Date().toISOString();
    if (!result.success) {
      return { verified: false, details: 'Execution failed', timestamp: now };
    }

    const data: any = result.data;
    const userId = data?.user_id || 'user_ben';

    if (capability === 'create_outcome') {
      const outcomes = await PersonalModelService.getOutcomes(userId);
      const exists = outcomes.some((o) => o.id === data.id);
      return {
        verified: exists,
        details: exists
          ? `Verified outcome "${data.title}" exists in SQLite.`
          : `Outcome ${data.id} not found during verification.`,
        timestamp: now
      };
    }

    if (capability === 'create_rule') {
      const rules = await PersonalModelService.getRules(userId);
      const exists = rules.some((r) => r.id === data.id);
      return {
        verified: exists,
        details: exists
          ? `Verified rule "${data.statement}" exists in SQLite.`
          : `Rule ${data.id} not found during verification.`,
        timestamp: now
      };
    }

    return { verified: true, timestamp: now };
  }
}

// ─── 3. Communication Tool (High Risk) ───────────────────────────────────────
export class CommunicationTool implements OrionTool {
  name = 'communication';
  public sentMessages: Array<{ id: string; to: string; subject: string; body: string; sentAt: string }> = [];

  capabilities(): ToolCapability[] {
    return [
      {
        name: 'send_email',
        description: 'Dispatch external email message to third party',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['to', 'subject', 'body']
        },
        riskLevel: 'HIGH',
        reversible: false
      }
    ];
  }

  async execute(capability: string, input: any): Promise<ToolResult> {
    if (capability === 'send_email') {
      const msgId = `msg_${Date.now()}`;
      const record = {
        id: msgId,
        to: input.to,
        subject: input.subject,
        body: input.body,
        sentAt: new Date().toISOString()
      };
      this.sentMessages.push(record);

      return {
        success: true,
        status: 'DISPATCHED',
        source: 'communication',
        data: { messageId: msgId, ...record }
      };
    }

    throw new Error(`Unsupported capability [${capability}] on CommunicationTool`);
  }

  async verify(capability: string, result: ToolResult): Promise<VerificationResult> {
    const now = new Date().toISOString();
    if (!result.success) {
      return { verified: false, details: 'Message dispatch failed', timestamp: now };
    }

    const data: any = result.data;
    if (capability === 'send_email') {
      const exists = this.sentMessages.some((m) => m.id === data.messageId);
      return {
        verified: exists,
        details: exists
          ? `Verified message ${data.messageId} logged in outbound transmission spool.`
          : `Message ${data.messageId} missing from transmission spool.`,
        timestamp: now
      };
    }

    return { verified: true, timestamp: now };
  }
}

// ─── 4. Tool Router Registry ─────────────────────────────────────────────────
export class ToolRouter {
  private tools: Map<string, OrionTool> = new Map();

  constructor() {
    this.registerTool(new CalendarTool());
    this.registerTool(new PersonalModelTool());
    this.registerTool(new CommunicationTool());
  }

  registerTool(tool: OrionTool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): OrionTool | undefined {
    return this.tools.get(name);
  }

  listCapabilities(): ToolCapability[] {
    const capabilities: ToolCapability[] = [];
    for (const tool of this.tools.values()) {
      capabilities.push(...tool.capabilities());
    }
    return capabilities;
  }

  getCapability(toolName: string, capabilityName: string): ToolCapability | undefined {
    const tool = this.getTool(toolName);
    if (!tool) return undefined;
    return tool.capabilities().find((c) => c.name === capabilityName);
  }
}

export const toolRouter = new ToolRouter();
