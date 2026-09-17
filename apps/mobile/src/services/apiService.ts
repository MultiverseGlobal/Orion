// Route to local Next.js API in development. 
// For physical devices, use your local IP instead of localhost (e.g. http://192.168.1.X:3000)
// If using Android emulator, use http://10.0.2.2:3000
import { Platform } from 'react-native';
import EventSource from 'react-native-sse';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'https://pseudonyms.vercel.app/api';
};

const WEB_API_URL = getBaseUrl();

// ── Orion Express Server URL ──────────────────────────────────────────────────
const getServerUrl = () => {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3005';
  return 'http://localhost:3005';
};

const SERVER_URL = getServerUrl();

export interface ChatResponse {
  reply: string;
  time: string;
}

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  try {
    const res = await fetch(`${WEB_API_URL}/reasoner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.reply) {
        return {
          reply: json.reply,
          time: timeStr,
        };
      }
    } else {
      console.log('Web API returned an error status:', res.status);
    }
  } catch (err) {
    console.log('Error hitting Web API /chat:', err);
  }

  return {
    reply: "I am having trouble connecting to the Web Brain API.",
    time: timeStr,
  };
}

export function streamOrionChat(
  messages: any[], 
  onChunk: (text: string) => void,
  onToolCall: (toolCall: any) => void,
  onComplete: () => void,
  onError: () => void
) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    console.error("Missing Supabase configuration");
    onError();
    return null;
  }

  const url = `${supabaseUrl}/functions/v1/orion-chat`;
  
  const es = new EventSource(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey
    },
    body: JSON.stringify({ messages })
  });

  es.addEventListener('message', (event) => {
    if (event.data) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'text-delta' && data.textDelta) {
          onChunk(data.textDelta);
        } else if (data.type === 'tool-call') {
          onToolCall(data);
        }
      } catch (e) {
        // Vercel AI SDK text streams might not be JSON if using streamText directly without data protocol, 
        // but `toDataStreamResponse` sends `0:"text"` format.
        // For `toDataStreamResponse()`, it sends specific stream parts. Let's handle the Vercel AI SDK protocol format:
        const raw = event.data;
        if (raw.startsWith('0:')) {
          onChunk(JSON.parse(raw.substring(2)));
        } else if (raw.startsWith('9:')) {
          onToolCall(JSON.parse(raw.substring(2)));
        } else if (raw.startsWith('d:')) {
          onComplete();
          es.close();
        }
      }
    }
  });

  es.addEventListener('error', (event) => {
    console.error('SSE Error:', event);
    es.close();
    onError();
  });

  return es;
}

export async function getHomeState() {
  try {
    const res = await fetch(`${WEB_API_URL}/home`);
    if (!res.ok) throw new Error('Failed to fetch home state');
    return await res.json();
  } catch (err) {
    console.error('Error fetching home state:', err);
    return null;
  }
}

// ── Orientation (polled by ProactivePresenceManager) ──────────────────────────

export interface OrientationResponse {
  success: boolean;
  orbState: string;
  pendingApprovals: PendingApprovalItem[];
  proactiveSpeech: { text: string; reason: string } | null;
  focusContext?: { currentActivity?: string; availableMinutes?: number };
}

export interface PendingApprovalItem {
  id: string;
  tool: string;
  capability: string;
  what: string;
  why: string;
  whatWillChange: { target: string; from: string | null; to: string };
  riskLevel: string;
  stagedAt: string;
  supportsRollback: boolean;
}

export async function fetchOrientation(userId = 'user_ben'): Promise<OrientationResponse | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/home/orientation?userId=${userId}`);
    if (!res.ok) throw new Error(`orientation failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[apiService] fetchOrientation error:', err);
    return null;
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

export interface ActionItem {
  id: string;
  description: string;
  tool: string;
  capability: string;
  status: string;
  risk_level: string;
  created_at: string;
  payload?: Record<string, any>;
}

export async function fetchActions(userId = 'user_ben', status?: string): Promise<{ actions: ActionItem[] } | null> {
  try {
    const qs = status ? `&status=${status}` : '';
    const res = await fetch(`${SERVER_URL}/api/agency/actions?userId=${userId}${qs}`);
    if (!res.ok) throw new Error(`actions failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[apiService] fetchActions error:', err);
    return null;
  }
}

export async function approveAction(id: string, userId = 'user_ben') {
  try {
    const res = await fetch(`${SERVER_URL}/api/home/action/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) throw new Error(`approve failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[apiService] approveAction error:', err);
    throw err;
  }
}

export async function rejectAction(id: string, userId = 'user_ben', reason?: string) {
  try {
    const res = await fetch(`${SERVER_URL}/api/home/action/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, reason }),
    });
    if (!res.ok) throw new Error(`reject failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[apiService] rejectAction error:', err);
    throw err;
  }
}

// ── Cognitive interact (voice & text conversation) ────────────────────────────

export interface CognitiveResponse {
  success: boolean;
  data: {
    reply: string;
    actions?: any[];
    memories?: any[];
  };
}

export async function sendMessage(
  userId = 'user_ben',
  message: string,
  surface: 'voice' | 'chat' = 'voice'
): Promise<CognitiveResponse | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/cognitive/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, surface }),
    });
    if (!res.ok) throw new Error(`interact failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[apiService] sendMessage error:', err);
    return null;
  }
}

// ── Memory (for Memory environment) ───────────────────────────────────────────

export async function fetchMemoryRecords(userId = 'user_ben') {
  try {
    const res = await fetch(`${SERVER_URL}/api/personal-model/overview?userId=${userId}`);
    if (!res.ok) throw new Error(`memory fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[apiService] fetchMemoryRecords error:', err);
    return null;
  }
}

export async function forgetMemory(table: string, id: string, userId = 'user_ben') {
  try {
    const res = await fetch(`${SERVER_URL}/api/memory/forget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, table, id }),
    });
    if (!res.ok) throw new Error(`forget failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[apiService] forgetMemory error:', err);
    throw err;
  }
}

export interface MemoryItem {
  id: string;
  table: string;
  content: string;
  description: string;
  importance: number;
  confidence?: number;
  scope?: string;
  created_at: string;
}

// ── Journey (for Journey environment) ─────────────────────────────────────────

export interface JourneyEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  created_at: string;
  reasoning?: string;
}

export async function fetchJourneyData(userId = 'user_ben') {
  try {
    const [outcomesRes, overviewRes] = await Promise.all([
      fetch(`${SERVER_URL}/api/personal-model/outcomes?userId=${userId}`),
      fetch(`${SERVER_URL}/api/personal-model/overview?userId=${userId}`)
    ]);

    if (!outcomesRes.ok || !overviewRes.ok) {
      throw new Error('journey data fetch failed');
    }

    const outcomesData = await outcomesRes.json();
    const overviewData = await overviewRes.json();

    return {
      outcomes: outcomesData,
      overview: overviewData,
    };
  } catch (err) {
    console.warn('[apiService] fetchJourneyData error:', err);
    return null;
  }
}

