import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TOKENS } from '../../constants/tokens';
import { PDS_TYPOGRAPHY } from '../../constants/typography';

export type ApprovalPhase = 'REVIEW' | 'EXECUTING' | 'VERIFYING' | 'VERIFIED' | 'FAILED';

export interface ApprovalCardProps {
  what: string;
  why: string;
  whatWillChange: { target: string; from: string | null; to: string };
  riskLevel: string;
  phase: ApprovalPhase;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ what, why, whatWillChange, riskLevel, phase }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{what}</Text>
      <Text style={styles.description}>{why}</Text>
      <View style={styles.changeBox}>
        <Text style={styles.label}>CHANGES ({whatWillChange.target})</Text>
        <Text style={styles.changeText}>{whatWillChange.from ? `${whatWillChange.from} -> ` : ''}{whatWillChange.to}</Text>
      </View>
      <Text style={styles.risk}>RISK: {riskLevel}</Text>
      {phase !== 'REVIEW' && (
        <Text style={styles.phaseIndicator}>Status: {phase}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: TOKENS.colors.surfaceHighlight,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: TOKENS.colors.border,
    marginBottom: 32,
  },
  title: {
    ...PDS_TYPOGRAPHY.header3,
    color: TOKENS.colors.primary,
    marginBottom: 8,
  },
  description: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.muted,
    marginBottom: 16,
  },
  changeBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  label: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.muted,
    marginBottom: 4,
  },
  changeText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.primary,
  },
  risk: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.accent,
    marginBottom: 16,
  },
  phaseIndicator: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.primary,
    marginTop: 16,
    textAlign: 'center',
  }
});
