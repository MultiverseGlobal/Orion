// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { X, Volume2, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { OrionFileCard } from '../store/useOrionStore';
import { speakBriefing } from '../services/audioService';
import { SpringButton } from './SpringButton';
import { Colors } from '../theme/colors';

const { height } = Dimensions.get('window');

interface ZoomCardProps {
  visible: boolean;
  fileCard: OrionFileCard | null;
  onDismiss: () => void;
  onAction?: (actionName: string) => void;
}

export const ZoomCard: React.FC<ZoomCardProps> = ({
  visible,
  fileCard,
  onDismiss,
  onAction,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      progress.value = withSpring(1, {
        damping: 24,
        stiffness: 200,
        mass: 0.8,
      });
    } else {
      progress.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [visible, progress]);

  // Swipe-down pan responder for spatial dismissal
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Compress scale and increase translation
          progress.value = Math.max(0, 1 - gestureState.dy / (height / 1.5));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          onDismiss();
        } else {
          progress.value = withSpring(1, { damping: 24, stiffness: 200 });
        }
      },
    })
  ).current;

  const animatedCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP);
    const translateY = interpolate(progress.value, [0, 1], [height * 0.15, 0], Extrapolation.CLAMP);
    const opacity = progress.value;
    
    return {
      opacity,
      transform: [
        { scale },
        { translateY }
      ],
    };
  });

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: visible ? withTiming(1, { duration: 400 }) : withTiming(0, { duration: 300 }),
    pointerEvents: visible ? 'auto' : 'none',
  }));

  if (!fileCard || (!visible && progress.value === 0)) return null;

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, animatedBackdropStyle, { zIndex: 99 }]}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[styles.cardContainer, animatedCardStyle]}
        {...panResponder.panHandlers}
      >
        {/* Handle Bar */}
      <View style={styles.handleBar} />

      <View style={styles.content}>
        {/* Header Badge */}
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>EXECUTIVE BRIEF</Text>
          </View>
          <SpringButton onPress={onDismiss} style={styles.closeBtn}>
            <X size={18} color={Colors.textMuted} />
          </SpringButton>
        </View>

        {/* Title & Metadata */}
        <Text style={styles.title}>{fileCard?.name}</Text>
        <Text style={styles.subtitle}>{fileCard?.format} • {fileCard?.size}</Text>
        <Text style={styles.timestampText}>Created {fileCard?.timestamp}</Text>

        {/* Summary Content Box */}
        <View style={styles.bodyBox}>
          <Text style={styles.bodyText}>
            This executive briefing contains synthesized metrics, team deliverables, and market intelligence compiled by Orion.
          </Text>
        </View>

        {/* Executive Action Buttons */}
        <View style={styles.actionsGroup}>
          <SpringButton
            onPress={() => {
              speakBriefing(`${fileCard?.name}. This executive briefing contains synthesized metrics, team deliverables, and market intelligence compiled by Orion.`);
            }}
            style={styles.listenActionBtn}
          >
            <Volume2 size={16} color={Colors.textPrimary} />
            <Text style={styles.listenActionText}>Listen Aloud</Text>
          </SpringButton>

          <SpringButton
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onAction?.('Accept Action Item');
              onDismiss();
            }}
            style={styles.primaryActionBtn}
          >
            <CheckCircle size={16} color={Colors.porcelain} />
            <Text style={styles.primaryActionText}>Execute</Text>
          </SpringButton>
        </View>
      </View>
    </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: height * 0.15,
    width: '90%',
    backgroundColor: Colors.porcelain,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
    zIndex: 100,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  content: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    backgroundColor: Colors.porcelainSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    color: Colors.textPrimary,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timestampText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  bodyBox: {
    backgroundColor: Colors.porcelainSubtle,
    padding: 16,
    borderRadius: 14,
    marginVertical: 6,
  },
  bodyText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  listenActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.porcelainSubtle,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  listenActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.porcelain,
  },
});
