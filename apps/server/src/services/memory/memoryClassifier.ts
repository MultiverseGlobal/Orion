/**
 * Orion Build Spec V1 — Section 6 & 23.4: Memory Classification Service
 *
 * Classifies candidate statements into:
 * FACT, GOAL, OUTCOME, COMMITMENT, RULE, PREFERENCE, DECISION, PATTERN, TEMPORARY_STATE, KNOWLEDGE, NOT_MEMORY
 *
 * Enforces:
 * - "No silent authority escalation" (Section 7.7)
 * - Temporary statements are never mistakenly promoted to permanent rules/goals
 */

import {
  MemoryCandidate,
  ClassifiedMemory,
  MemoryClassificationType
} from '@orion/types';

export class MemoryClassifierService {
  /**
   * Classifies a candidate memory string or object.
   */
  static classify(input: string | MemoryCandidate): ClassifiedMemory {
    const candidate: MemoryCandidate = typeof input === 'string'
      ? { text: input, source: 'USER_EXPLICIT', timestamp: new Date().toISOString() }
      : { ...input, timestamp: input.timestamp || new Date().toISOString() };

    const text = candidate.text.trim();
    const lower = text.toLowerCase();

    // 1. Filter trivial greetings / conversational filler -> NOT_MEMORY
    if (this.isNotMemory(lower)) {
      return {
        candidate,
        type: 'NOT_MEMORY',
        confidence: 0.99,
        persist: false,
        scope: 'SESSION',
        authority: 'SUPPORTED_INFERENCE',
        needsConfirmation: false,
        reasoning: 'Conversational filler or transient greeting without durable cognitive value.'
      };
    }

    // 2. Check for Temporary / Ephemeral State -> TEMPORARY_STATE (Do NOT persist)
    if (this.isTemporaryState(lower)) {
      return {
        candidate,
        type: 'TEMPORARY_STATE',
        confidence: 0.92,
        persist: false,
        scope: 'SESSION',
        authority: 'EXPLICIT_USER',
        expiration: new Date(Date.now() + 8 * 3600 * 1000).toISOString(), // expires within ~8h
        needsConfirmation: false,
        reasoning: 'Fleeting emotional, physical, or environmental state. Valid for immediate context, not permanent storage.'
      };
    }

    // 3. Check for Patterns (Recurring tendencies, cycles, behavioral heuristics)
    if (this.isPattern(lower)) {
      return {
        candidate,
        type: 'PATTERN',
        confidence: 0.85,
        persist: true,
        scope: this.inferScope(lower),
        authority: 'SUPPORTED_INFERENCE',
        needsConfirmation: false,
        proposedEntity: {
          table: 'patterns',
          data: {
            statement: text,
            confidence: 0.8,
            frequency: 1.0,
            confirmation_status: 'CONFIRMED'
          }
        },
        reasoning: 'Observed or reported recurring behavioral tendency or cognitive cycle.'
      };
    }

    // 4. Check for Rules (Hard constraints, prohibitions, operating invariants)
    if (this.isRule(lower)) {
      const priority = lower.includes('non-negotiable') || lower.includes('never') || lower.includes('must always') ? 1 : 2;
      return {
        candidate,
        type: 'RULE',
        confidence: 0.95,
        persist: true,
        scope: this.inferScope(lower),
        authority: 'EXPLICIT_USER',
        needsConfirmation: false,
        proposedEntity: {
          table: 'rules',
          data: {
            statement: text,
            priority,
            scope: this.inferScope(lower),
            conditions: {},
            exceptions: {},
            source: candidate.source || 'USER_EXPLICIT'
          }
        },
        reasoning: 'Explicit principle or operational constraint with high governing priority.'
      };
    }

    // 5. Check for Commitments (Promises, external obligations, deadlines)
    if (this.isCommitment(lower)) {
      const dueAt = this.extractDueDate(lower);
      return {
        candidate,
        type: 'COMMITMENT',
        confidence: 0.90,
        persist: true,
        scope: this.inferScope(lower),
        authority: 'EXPLICIT_USER',
        needsConfirmation: false,
        proposedEntity: {
          table: 'commitments',
          data: {
            title: text,
            due_at: dueAt,
            consequence: this.inferConsequence(lower),
            importance: 0.85,
            source: candidate.source || 'USER_EXPLICIT'
          }
        },
        reasoning: 'External obligation or time-bound promise with accountability consequence.'
      };
    }

    // 6. Check for Decisions (Resolved intentional conclusions, choices with rationale)
    if (this.isDecision(lower)) {
      return {
        candidate,
        type: 'DECISION',
        confidence: 0.92,
        persist: true,
        scope: this.inferScope(lower),
        authority: 'EXPLICIT_USER',
        needsConfirmation: false,
        proposedEntity: {
          table: 'decisions',
          data: {
            statement: text,
            reason: this.extractReason(text),
            scope: this.inferScope(lower)
          }
        },
        reasoning: 'Intentional conclusion or settled choice between alternatives.'
      };
    }

    // 7. Check for Goals (Strategic objectives, long-term aspirations)
    if (this.isGoal(lower)) {
      return {
        candidate,
        type: 'GOAL',
        confidence: 0.88,
        persist: true,
        scope: this.inferScope(lower),
        authority: 'EXPLICIT_USER',
        needsConfirmation: false,
        proposedEntity: {
          table: 'goals',
          data: {
            title: text,
            importance: 0.9,
            horizon: this.inferHorizon(lower)
          }
        },
        reasoning: 'Strategic destination or desired future state.'
      };
    }

    // 8. Check for Preferences (Subjective heuristics, inclinations, aesthetics)
    if (this.isPreference(lower)) {
      return {
        candidate,
        type: 'PREFERENCE',
        confidence: 0.90,
        persist: true,
        scope: this.inferScope(lower),
        authority: 'EXPLICIT_USER',
        needsConfirmation: false,
        proposedEntity: {
          table: 'preferences',
          data: {
            statement: text,
            confidence: 0.9,
            scope: this.inferScope(lower),
            source: candidate.source || 'USER_EXPLICIT'
          }
        },
        reasoning: 'Subjective preference or heuristic for communication, workflow, or tools.'
      };
    }

    // 9. Default: Fact / Knowledge
    return {
      candidate,
      type: 'FACT',
      confidence: 0.75,
      persist: true,
      scope: 'GENERAL',
      authority: 'SUPPORTED_INFERENCE',
      needsConfirmation: false,
      proposedEntity: {
        table: 'knowledge',
        data: {
          topic: text.slice(0, 50),
          content: text,
          confidence: 0.8
        }
      },
      reasoning: 'General factual statement or domain knowledge.'
    };
  }

  // ─── Classification Heuristics ──────────────────────────────────────────────

  private static isNotMemory(text: string): boolean {
    const trivial = ['hello', 'hi', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'sure', 'goodbye', 'bye'];
    if (trivial.includes(text) || text.length < 3) return true;

    const trivialWords = new Set(['hello', 'hi', 'hey', 'thanks', 'thank', 'you', 'so', 'much', 'ok', 'okay', 'yes', 'no', 'sure', 'goodbye', 'bye', 'cool', 'great', 'awesome']);
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.every(w => trivialWords.has(w))) {
      return true;
    }
    return false;
  }

  private static isTemporaryState(text: string): boolean {
    const markers = [
      'i am tired', 'i\'m tired', 'exhausted', 'sleepy', 'drained',
      'working from a coffee shop', 'at the airport', 'on the train',
      'it is raining', 'it\'s raining', 'bad weather',
      'headache', 'feeling sick', 'hungry', 'in a rush',
      'right now i feel', 'for today only', 'just for now'
    ];
    return markers.some(m => text.includes(m));
  }

  private static isRule(text: string): boolean {
    if (text.startsWith('i notice') || text.includes('struggle with') || text.includes('tend to')) return false;
    const markers = [
      'never ', 'always ', 'do not ', 'don\'t ever', 'no deep work after',
      'rule:', 'my rule is', 'non-negotiable', 'under no circumstances',
      'must never', 'must always', 'require confirmation before'
    ];
    return markers.some(m => text.includes(m));
  }

  private static isCommitment(text: string): boolean {
    const markers = [
      'i promised', 'promised to', 'committed to', 'i owe', 'deadline is',
      'by tomorrow', 'by friday', 'by monday', 'by 5pm', 'deliver to', 'send to'
    ];
    return markers.some(m => text.includes(m));
  }

  private static isDecision(text: string): boolean {
    const markers = [
      'i decided', 'we decided', 'decision:', 'chose to', 'chosen to',
      'settled on', 'opted for', 'will go with', 'have decided'
    ];
    return markers.some(m => text.includes(m));
  }

  private static isGoal(text: string): boolean {
    const markers = [
      'my goal is', 'our goal is', 'i want to achieve', 'aspire to',
      'target is', 'aim to reach', 'by end of q'
    ];
    return markers.some(m => text.includes(m));
  }

  private static isPattern(text: string): boolean {
    const markers = [
      'i notice that', 'i always struggle with', 'tend to', 'usually feel',
      'recurring', 'habitually', 'every afternoon i', 'pattern:'
    ];
    return markers.some(m => text.includes(m));
  }

  private static isPreference(text: string): boolean {
    const markers = [
      'i prefer', 'prefer to', 'i like ', 'i enjoy', 'favourite',
      'preference:', 'i lean towards', 'please keep it concise',
      'shorter answers'
    ];
    return markers.some(m => text.includes(m));
  }

  private static inferScope(text: string): string {
    if (text.includes('health') || text.includes('sleep') || text.includes('workout') || text.includes('gym') || text.includes('diet')) {
      return 'HEALTH';
    }
    if (text.includes('code') || text.includes('deploy') || text.includes('client') || text.includes('investor') || text.includes('atlas') || text.includes('revenue')) {
      return 'WORK';
    }
    return 'GENERAL';
  }

  private static inferHorizon(text: string): string {
    if (text.includes('q1')) return 'Q1';
    if (text.includes('q2')) return 'Q2';
    if (text.includes('q3')) return 'Q3';
    if (text.includes('q4')) return 'Q4';
    if (text.includes('this year')) return 'Annual';
    return 'Medium-term';
  }

  private static extractDueDate(text: string): string | null {
    const now = Date.now();
    if (text.includes('tomorrow')) {
      return new Date(now + 24 * 3600 * 1000).toISOString();
    }
    if (text.includes('next week')) {
      return new Date(now + 7 * 24 * 3600 * 1000).toISOString();
    }
    return null;
  }

  private static inferConsequence(text: string): string {
    if (text.includes('investor') || text.includes('board')) return 'Erosion of stakeholder trust';
    if (text.includes('client') || text.includes('customer')) return 'Customer dissatisfaction or churn';
    return 'Broken obligation and reputational drag';
  }

  private static extractReason(text: string): string | null {
    const match = text.match(/because\s+(.+)|due to\s+(.+)|since\s+(.+)/i);
    if (match) {
      return (match[1] || match[2] || match[3] || '').trim();
    }
    return null;
  }
}
