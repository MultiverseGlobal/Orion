/**
 * Orion Build Spec V1 — Section 6.3 & 7: Memory Promotion Pipeline
 *
 * Coordinates:
 * Ingestion -> Classification -> Authority Check -> Promotion / Write-back
 *
 * Invariants:
 * - Temporary statements are never written to operational tables.
 * - Explicit user decisions and rules are automatically promoted.
 * - Inferred commitments/goals require confirmation before escalation.
 */

import {
  ClassifiedMemory,
  PromotionResult,
  MemoryCandidate
} from '@orion/types';
import { MemoryClassifierService } from './memoryClassifier';
import { PersonalModelService } from '../personalModel/personalModelService';
import { MetaphorAdapter } from './metaphorAdapter';

export class MemoryPromotionPipeline {
  private static metaphor = new MetaphorAdapter();

  /**
   * Evaluates and promotes a candidate statement or classified memory.
   */
  static async ingestAndPromote(
    userId: string,
    input: string | MemoryCandidate | ClassifiedMemory
  ): Promise<PromotionResult> {
    // 1. Classify if not already classified
    const isClassified = typeof input === 'object' && input !== null && 'type' in input;
    const classified: ClassifiedMemory = isClassified
      ? (input as ClassifiedMemory)
      : MemoryClassifierService.classify(input as string | MemoryCandidate);

    const { type, persist, needsConfirmation, proposedEntity, candidate } = classified;

    // 2. Reject non-persistent / temporary items
    if (!persist || type === 'NOT_MEMORY') {
      return {
        promoted: false,
        type,
        message: `Ignored: Classified as ${type}, no operational persistence required.`
      };
    }

    if (type === 'TEMPORARY_STATE') {
      return {
        promoted: false,
        type,
        message: 'Ephemeral state captured in working context; not promoted to permanent model.'
      };
    }

    // 3. Check for Confirmation requirement (Section 7.6)
    if (needsConfirmation) {
      return {
        promoted: false,
        type,
        needsConfirmation: true,
        message: `Candidate ${type} requires user confirmation before authority escalation.`
      };
    }

    // 4. Promote to Operational Database via PersonalModelService
    switch (type) {
      case 'RULE': {
        const entity = await PersonalModelService.createRule({
          user_id: userId,
          statement: proposedEntity?.data.statement || candidate.text,
          priority: proposedEntity?.data.priority ?? 1,
          scope: proposedEntity?.data.scope || 'GENERAL',
          conditions: proposedEntity?.data.conditions || {},
          exceptions: proposedEntity?.data.exceptions || {},
          source: candidate.source || 'USER_EXPLICIT'
        });
        return {
          promoted: true,
          type,
          entityId: entity.id,
          table: 'rules',
          message: `Rule [P${entity.priority}] promoted to Personal Model: "${entity.statement}"`
        };
      }

      case 'COMMITMENT': {
        const entity = await PersonalModelService.createCommitment({
          user_id: userId,
          title: proposedEntity?.data.title || candidate.text,
          due_at: proposedEntity?.data.due_at || null,
          consequence: proposedEntity?.data.consequence || 'Broken commitment',
          importance: proposedEntity?.data.importance ?? 0.8,
          source: candidate.source || 'USER_EXPLICIT'
        });
        return {
          promoted: true,
          type,
          entityId: entity.id,
          table: 'commitments',
          message: `Commitment promoted: "${entity.title}"`
        };
      }

      case 'DECISION': {
        // Check for potential supersession
        const existingDecisions = await PersonalModelService.getDecisions(userId, 'ACTIVE');
        let supersedesId: string | null = null;
        const textLower = candidate.text.toLowerCase();

        // If this decision shares the same scope or directly contradicts an earlier one
        for (const prev of existingDecisions) {
          if (prev.scope === (proposedEntity?.data.scope || 'GENERAL') && textLower.includes('instead of')) {
            supersedesId = prev.id;
            break;
          }
        }

        const entity = await PersonalModelService.recordDecision({
          user_id: userId,
          statement: proposedEntity?.data.statement || candidate.text,
          reason: proposedEntity?.data.reason || null,
          scope: proposedEntity?.data.scope || 'GENERAL',
          supersedes_id: supersedesId
        });

        return {
          promoted: true,
          type,
          entityId: entity.id,
          table: 'decisions',
          supersededId: supersedesId,
          message: supersedesId
            ? `Decision promoted (superseding ${supersedesId}): "${entity.statement}"`
            : `Decision recorded: "${entity.statement}"`
        };
      }

      case 'PREFERENCE': {
        const entity = await PersonalModelService.createPreference({
          user_id: userId,
          statement: proposedEntity?.data.statement || candidate.text,
          confidence: proposedEntity?.data.confidence ?? 0.9,
          scope: proposedEntity?.data.scope || 'GENERAL',
          source: candidate.source || 'USER_EXPLICIT'
        });
        return {
          promoted: true,
          type,
          entityId: entity.id,
          table: 'preferences',
          message: `Preference recorded: "${entity.statement}"`
        };
      }

      case 'GOAL': {
        const entity = await PersonalModelService.createGoal({
          user_id: userId,
          title: proposedEntity?.data.title || candidate.text,
          importance: proposedEntity?.data.importance ?? 0.9,
          horizon: proposedEntity?.data.horizon || 'Medium-term'
        });
        return {
          promoted: true,
          type,
          entityId: entity.id,
          table: 'goals',
          message: `Goal established: "${entity.title}"`
        };
      }

      case 'PATTERN': {
        const entity = await PersonalModelService.recordPattern({
          user_id: userId,
          statement: proposedEntity?.data.statement || candidate.text,
          confidence: proposedEntity?.data.confidence ?? 0.8,
          frequency: proposedEntity?.data.frequency ?? 1.0,
          confirmation_status: 'CONFIRMED'
        });
        return {
          promoted: true,
          type,
          entityId: entity.id,
          table: 'patterns',
          message: `Behavioral pattern recorded: "${entity.statement}"`
        };
      }

      case 'FACT':
      case 'KNOWLEDGE':
      default: {
        const memoryId = await this.metaphor.store({
          userId,
          text: candidate.text,
          type,
          confidence: classified.confidence,
          metadata: { source: candidate.source || 'USER_EXPLICIT' }
        });
        return {
          promoted: true,
          type,
          entityId: memoryId,
          table: 'knowledge',
          message: `Fact stored in deep memory: "${candidate.text.slice(0, 60)}..."`
        };
      }
    }
  }
}
