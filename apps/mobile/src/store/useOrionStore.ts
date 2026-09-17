/**
 * useOrionStore.ts
 * 
 * Global state for the Orion mobile app, built on Zustand.
 * Replaces the previous hand-rolled pub/sub class which was incompatible
 * with React 18 Concurrent Mode and could cause state-tearing.
 * 
 * - All state mutations use immer for safe immutability.
 * - Settings are persisted to AsyncStorage via the persist middleware.
 * - Node/data loading actions are async and call the BrainGateway server.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchKnowledgeNodes } from '../services/dbService';

// ─── Core Types ───────────────────────────────────────────────────────────────

// ── Phase 8: Environment State Machine ────────────────────────────────────────

export type OrionEnvironment =
  | 'LIVING_MODE'
  | 'TEXT_MODE'
  | 'NEEDS_YOU'
  | 'ACTION_CENTRE'
  | 'JOURNEY'
  | 'MEMORY'
  | 'CALENDAR'
  | 'EMAIL'
  | 'BROWSER'
  | 'PROJECT'
  | 'CONNECTED_WORLD';

export type OrbState =
  | 'breathing'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'speaking'
  | 'working'
  | 'needs_you'
  | 'error';

export type VoiceSessionState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'PLAYING'
  | 'INTERRUPTED'
  | 'ENDED'
  | 'ERROR';

// ── Legacy Stage type (kept for backward compat) ──────────────────────────────

export type AppStage = 'LISTENING' | 'PROCESSING' | 'CONSTELLATION' | 'FILE_STACK' | 'EDIT_MODE' | 'CHAT';

export interface CardItem {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  type: 'meeting' | 'brief' | 'mission' | 'settings' | 'timeline';
  actionLabel?: string;
  urgent?: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  toolInvocations?: any[];
}

export interface GenerativeBlock {
  id: string;
  type: 'lead_card' | 'progress_ring' | 'draft';
  data: any;
  messageId: string;
}

export interface OrionFileCard {
  id: string;
  name: string;
  size: string;
  timestamp: string;
  format: string;
  iconType: 'document' | 'calendar' | 'chart' | 'cube' | 'layers' | 'shield';
}

export interface ConstellationNode {
  id: string;
  label: string;
  isPrimary?: boolean;
  xPercent: number; // 0–100
  yPercent: number; // 0–100
  fileCount: number;
}

// ─── Default Data ──────────────────────────────────────────────────────────────

const DEFAULT_NODE: ConstellationNode = {
  id: 'briefings',
  label: 'Executive Briefings',
  isPrimary: true,
  xPercent: 50,
  yPercent: 48,
  fileCount: 0,
};

// ─── State Shape ──────────────────────────────────────────────────────────────

interface OrionState {
  // ── Phase 8: Environment state machine ────────────────────────────────
  environment: OrionEnvironment;
  environmentHistory: OrionEnvironment[];
  orbState: OrbState;
  voiceState: VoiceSessionState;
  transientSpeech: string | null; // Text displayed below orb while speaking

  // App flow
  stage: AppStage;
  activeNode: ConstellationNode;
  isEditMode: boolean;
  queryText: string;
  isZoomed: boolean;
  activeItem: CardItem | null;

  // Data
  pendingCount: number;
  headlineIndex: number;
  items: CardItem[];
  files: OrionFileCard[];
  nodes: ConstellationNode[];
  chatMessages: AIMessage[];
  generativeBlocks: GenerativeBlock[];

  // Portrait
  portraitName: string;

  // Settings (persisted)
  settings: {
    voiceWake: boolean;
    urgentInterrupts: boolean;
    autoReschedule: boolean;
    hapticFeedback: boolean;
  };
}

// ─── Actions Shape ────────────────────────────────────────────────────────────

interface OrionActions {
  // ── Phase 8: Environment navigation ──────────────────────────────────
  navigate: (env: OrionEnvironment) => void;
  back: () => void;
  home: () => void;
  setOrbState: (state: OrbState) => void;
  setVoiceState: (state: VoiceSessionState) => void;
  setTransientSpeech: (text: string | null) => void;

  // Stage control
  setStage: (stage: AppStage) => void;
  selectNode: (node: ConstellationNode) => void;
  toggleEditMode: () => void;
  resetToListening: () => void;

  // Data mutations
  addFile: (file: OrionFileCard) => void;
  updateFile: (id: string, updates: Partial<OrionFileCard>) => void;
  deleteLastFile: () => void;
  addChatMessage: (msg: AIMessage) => void;
  updateChatMessage: (id: string, updates: Partial<AIMessage>) => void;
  addGenerativeBlock: (block: GenerativeBlock) => void;
  rotateHeadline: () => void;

  // Zoom card
  triggerZoom: (item?: CardItem) => void;
  dismissZoom: () => void;
  triggerUrgentInterrupt: (item: CardItem) => void;
  handlePushNotification: (item: CardItem) => void;

  // Portrait
  setPortraitName: (name: string) => void;

  // Nodes: load from server
  loadNodes: () => Promise<void>;

  // Settings
  updateSetting: (key: keyof OrionState['settings'], value: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOrionStore = create<OrionState & OrionActions>()(
  immer(
    persist(
      (set, get) => ({
        // ── Phase 8: Initial Environment State ─────────────────────────────
        environment: 'LIVING_MODE',
        environmentHistory: [],
        orbState: 'breathing',
        voiceState: 'IDLE',
        transientSpeech: null,

        // ── Initial State ──────────────────────────────────────────────────
        stage: 'LISTENING',
        activeNode: DEFAULT_NODE,
        isEditMode: false,
        queryText: '',
        isZoomed: false,
        activeItem: null,
        pendingCount: 3,
        headlineIndex: 0,
        items: [],
        files: [],
        nodes: [DEFAULT_NODE],
        chatMessages: [],
        generativeBlocks: [],
        portraitName: 'Orion',
        settings: {
          voiceWake: true,
          urgentInterrupts: true,
          autoReschedule: false,
          hapticFeedback: true,
        },

        // ── Phase 8: Environment Navigation ───────────────────────────────
        navigate: (env) =>
          set((s) => {
            if (s.environment !== env) {
              s.environmentHistory.push(s.environment);
              s.environment = env;
            }
          }),
        back: () =>
          set((s) => {
            if (s.environmentHistory.length > 0) {
              const prev = s.environmentHistory.pop();
              s.environment = prev as OrionEnvironment;
            } else {
              s.environment = 'LIVING_MODE'; // Fallback to safe base
            }
          }),
        home: () =>
          set((s) => {
            s.environment = 'LIVING_MODE';
            s.environmentHistory = [];
          }),
        setOrbState: (state) => set((s) => { s.orbState = state; }),
        setVoiceState: (state) =>
          set((s) => {
            s.voiceState = state;
            // Auto-sync orb visual state
            switch (state) {
              case 'IDLE': s.orbState = 'breathing'; break;
              case 'LISTENING': s.orbState = 'listening'; break;
              case 'PROCESSING': s.orbState = 'thinking'; break;
              case 'PLAYING': s.orbState = 'speaking'; break;
              case 'ERROR': s.orbState = 'error'; break;
              // INTERRUPTED and ENDED usually transition quickly to another state, leave orb as is for a moment
            }
          }),
        setTransientSpeech: (text) => set((s) => { s.transientSpeech = text; }),

        // ── Stage Control ─────────────────────────────────────────────────
        setStage: (stage) =>
          set((s) => {
            s.stage = stage;
            if (stage !== 'EDIT_MODE') {
              s.isEditMode = false;
            }
          }),

        selectNode: (node) =>
          set((s) => {
            s.activeNode = node;
            s.stage = 'FILE_STACK';
          }),

        toggleEditMode: () =>
          set((s) => {
            s.isEditMode = !s.isEditMode;
            s.stage = s.isEditMode ? 'EDIT_MODE' : 'FILE_STACK';
          }),

        resetToListening: () =>
          set((s) => {
            s.isEditMode = false;
            s.stage = 'LISTENING';
            s.chatMessages = [];
          }),

        // ── File Operations ───────────────────────────────────────────────
        addFile: (file) =>
          set((s) => {
            s.files.unshift(file);
          }),

        updateFile: (id, updates) =>
          set((s) => {
            const idx = s.files.findIndex((f) => f.id === id);
            if (idx !== -1) {
              Object.assign(s.files[idx], updates);
            }
          }),

        deleteLastFile: () =>
          set((s) => {
            s.files.pop();
          }),

        // ── Chat ──────────────────────────────────────────────────────────
        addChatMessage: (msg) =>
          set((s) => {
            s.chatMessages.push(msg);
          }),

        updateChatMessage: (id, updates) =>
          set((s) => {
            const idx = s.chatMessages.findIndex((m) => m.id === id);
            if (idx !== -1) {
              Object.assign(s.chatMessages[idx], updates);
            }
          }),

        addGenerativeBlock: (block) =>
          set((s) => {
            s.generativeBlocks.push(block);
          }),

        // ── Headline ──────────────────────────────────────────────────────
        rotateHeadline: () =>
          set((s) => {
            s.headlineIndex = (s.headlineIndex + 1) % Math.max(1, s.items.length);
          }),

        // ── Zoom Card ─────────────────────────────────────────────────────
        triggerZoom: (item) =>
          set((s) => {
            s.activeItem = item ?? s.items[0] ?? null;
            s.isZoomed = true;
          }),

        dismissZoom: () => {
          set((s) => {
            s.isZoomed = false;
            if (s.pendingCount > 0) {
              s.pendingCount = Math.max(0, s.pendingCount - 1);
            }
          });
          setTimeout(() => get().rotateHeadline(), 400);
        },

        triggerUrgentInterrupt: (item) =>
          set((s) => {
            s.activeItem = item;
            s.isZoomed = true;
          }),

        handlePushNotification: (item) =>
          set((s) => {
            s.activeItem = item;
            s.isZoomed = true;
          }),

        // ── Portrait ──────────────────────────────────────────────────────
        setPortraitName: (name) =>
          set((s) => {
            s.portraitName = name;
          }),

        // ── Nodes (fetched from server) ───────────────────────────────────
        loadNodes: async () => {
          try {
            const serverNodes = await fetchKnowledgeNodes();
            if (serverNodes.length === 0) return;

            // Map server knowledge nodes to constellation node layout
            const mapped: ConstellationNode[] = serverNodes.slice(0, 5).map((n, i) => ({
              id: n.id,
              label: n.label,
              isPrimary: i === 0,
              // Distribute nodes in a spread pattern
              xPercent: [50, 30, 70, 20, 80][i] ?? 50,
              yPercent: [48, 30, 30, 65, 65][i] ?? 50,
              fileCount: 0,
            }));

            set((s) => {
              s.nodes = mapped;
              s.activeNode = mapped[0];
            });
          } catch (err) {
            console.warn('[useOrionStore] Failed to load nodes:', err);
          }
        },

        // ── Settings ──────────────────────────────────────────────────────
        updateSetting: (key, value) =>
          set((s) => {
            s.settings[key] = value;
          }),
      }),
      {
        name: 'orion-store',
        storage: createJSONStorage(() => AsyncStorage),
        // Only persist settings — runtime state should reset on relaunch
        partialize: (state) => ({ settings: state.settings, portraitName: state.portraitName }),
      }
    )
  )
);
