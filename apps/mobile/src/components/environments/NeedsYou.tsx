import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useOrionStore } from '../../store/useOrionStore';
import { TOKENS } from '../../constants/tokens';
import { PDS_TYPOGRAPHY } from '../../constants/typography';
import { Check, Edit2, X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { approveAction, rejectAction, fetchOrientation, PendingApprovalItem } from '../../services/apiService';
import { ApprovalCard, ApprovalPhase } from '../ui/ApprovalCard';

const { width } = Dimensions.get('window');

export const NeedsYou: React.FC = () => {
  const { environment, back, setOrbState } = useOrionStore();
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  const [currentApproval, setCurrentApproval] = useState<PendingApprovalItem | null>(null);
  const [phase, setPhase] = useState<ApprovalPhase>('REVIEW');
  const isVisible = environment === 'NEEDS_YOU';

  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
      setOrbState('needs_you');
      setPhase('REVIEW');
      // Fetch live action
      fetchOrientation().then(data => {
        if (data && data.pendingApprovals && data.pendingApprovals.length > 0) {
          setCurrentApproval(data.pendingApprovals[0]);
        }
      });
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, setOrbState]);

  const handleSheetChange = (index: number) => {
    if (index === -1 && isVisible) {
      back();
      setOrbState('breathing');
    }
  };

  const handleApprove = async () => {
    if (!currentApproval) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('EXECUTING');
    setOrbState('working');
    try {
      const result = await approveAction(currentApproval.id);
      setPhase('VERIFYING');
      await new Promise(r => setTimeout(r, 800)); // Brief pause for visual effect
      if (result.verification?.passed) {
        setPhase('VERIFIED');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => { back(); setOrbState('breathing'); }, 1200);
      } else {
        setPhase('FAILED');
        setOrbState('error');
      }
    } catch {
      setPhase('FAILED');
      setOrbState('error');
    }
  };

  const handleReject = async () => {
    if (!currentApproval) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await rejectAction(currentApproval.id);
    } catch (e) {
      console.warn('Reject failed', e);
    }
    back();
    setOrbState('breathing');
  };

  const translateX = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .onUpdate((e) => { 
      translateX.value = Math.min(0, e.translationX); 
    })
    .onEnd((e) => {
      if (e.translationX < -120) {
        runOnJS(handleReject)();
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['50%', '80%']}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.indicator}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Approval Required</Text>
        </View>

        {currentApproval ? (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={animatedStyle}>
              <ApprovalCard 
                what={currentApproval.what}
                why={currentApproval.why}
                whatWillChange={currentApproval.whatWillChange}
                riskLevel={currentApproval.riskLevel}
                phase={phase}
              />
            </Animated.View>
          </GestureDetector>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>No pending approvals found.</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.button, styles.rejectBtn, phase !== 'REVIEW' && styles.disabledBtn]} 
            onPress={handleReject}
            disabled={phase !== 'REVIEW'}
          >
            <X size={20} color={TOKENS.colors.error} />
            <Text style={[styles.buttonText, { color: TOKENS.colors.error }]}>Reject</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.editBtn, phase !== 'REVIEW' && styles.disabledBtn]}
            disabled={phase !== 'REVIEW'}
          >
            <Edit2 size={18} color={TOKENS.colors.muted} />
            <Text style={[styles.buttonText, { color: TOKENS.colors.muted }]}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.approveBtn, phase !== 'REVIEW' && styles.disabledBtn]} 
            onPress={handleApprove}
            disabled={phase !== 'REVIEW'}
          >
            <Check size={20} color={TOKENS.colors.bg} />
            <Text style={[styles.buttonText, { color: TOKENS.colors.bg }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: TOKENS.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  indicator: {
    backgroundColor: TOKENS.colors.border,
    width: 40,
  },
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.accent,
  },
  card: {
    backgroundColor: TOKENS.colors.surfaceHighlight,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: TOKENS.colors.border,
    marginBottom: 32,
  },
  label: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.muted,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  editBtn: {
    backgroundColor: TOKENS.colors.surfaceHighlight,
  },
  approveBtn: {
    backgroundColor: TOKENS.colors.accent,
  },
  buttonText: {
    ...PDS_TYPOGRAPHY.bodyM,
    fontWeight: '500',
  },
  disabledBtn: {
    opacity: 0.5,
  }
});
