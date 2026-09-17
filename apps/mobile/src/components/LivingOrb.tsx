import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolateColor,
  withSpring
} from 'react-native-reanimated';
import { Canvas, Circle, RadialGradient, vec, Group, SweepGradient, Blur, Paint } from '@shopify/react-native-skia';
import { TOKENS } from '../constants/tokens';
import type { OrbState } from '../store/useOrionStore';

interface LivingOrbProps {
  state: OrbState;
}

export const LivingOrb: React.FC<LivingOrbProps> = ({ state }) => {
  const prevState = useRef<OrbState>(state);
  
  // Animation drivers
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);
  const ringRotation = useSharedValue(0);
  const stateColor = useSharedValue(0); // 0=breathing, 1=listening, 2=working/needs_you, 3=error

  useEffect(() => {
    if (prevState.current !== state) {
      switch (state) {
        case 'listening': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
        case 'needs_you': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
        case 'error': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
        case 'speaking': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      }
      AccessibilityInfo.announceForAccessibility(`Orion is now ${state}`);
      prevState.current = state;
    }

    switch (state) {
      case 'breathing':
        stateColor.value = withTiming(0, { duration: 600 });
        scale.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.94, { duration: 3000, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.3, { duration: 3000, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
        );
        ringRotation.value = withTiming(0, { duration: 1000 });
        break;

      case 'searching':
        stateColor.value = withTiming(0, { duration: 600 });
        scale.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.96, { duration: 1500, easing: Easing.inOut(Easing.ease) })
          ), -1, true
        );
        ringRotation.value = withRepeat(
          withTiming(360, { duration: 4000, easing: Easing.linear }),
          -1, false
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
          ), -1, true
        );
        break;

      case 'listening':
        stateColor.value = withTiming(1, { duration: 300 }); 
        scale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.05, { duration: 1200, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.85, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.5, { duration: 1200, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
        );
        ringRotation.value = withTiming(0, { duration: 500 });
        break;

      case 'speaking':
        stateColor.value = withTiming(0, { duration: 300 });
        scale.value = withRepeat(
          withSequence(
            withTiming(1.12, { duration: 400, easing: Easing.out(Easing.ease) }),
            withTiming(0.98, { duration: 500, easing: Easing.in(Easing.ease) })
          ),
          -1, true
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.8, { duration: 400, easing: Easing.out(Easing.ease) }),
            withTiming(0.4, { duration: 500, easing: Easing.in(Easing.ease) })
          ),
          -1, true
        );
        break;

      case 'thinking':
        stateColor.value = withTiming(0, { duration: 600 });
        scale.value = withRepeat(
          withSequence(
            withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.98, { duration: 2000, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
        );
        glowOpacity.value = withTiming(0.5, { duration: 800 });
        ringRotation.value = withRepeat(
          withTiming(360, { duration: 8000, easing: Easing.linear }),
          -1, false
        );
        break;

      case 'needs_you':
      case 'working':
        stateColor.value = withTiming(2, { duration: 800 }); 
        scale.value = withRepeat(
          withSequence(
            withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.95, { duration: 2000, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
        );
        ringRotation.value = state === 'working' 
          ? withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false)
          : withTiming(0, { duration: 1000 });
        break;

      case 'error':
        stateColor.value = withTiming(3, { duration: 200 }); 
        scale.value = withSequence(
          withSpring(1.2, { damping: 10, stiffness: 400 }),
          withSpring(1, { damping: 12, stiffness: 200 })
        );
        glowOpacity.value = withTiming(0.8, { duration: 200 });
        break;
    }
  }, [state, scale, glowOpacity, ringRotation, stateColor]);

  // Derive colors for Skia
  const coreColor = useDerivedValue(() => {
    return interpolateColor(stateColor.value, [0, 1, 2, 3], [TOKENS.colors.accent, '#FFFFFF', '#F59E0B', '#EF4444']);
  });

  const radialColors = useDerivedValue(() => {
    return [
      interpolateColor(stateColor.value, [0, 1, 2, 3], [TOKENS.colors.accent, '#FFFFFF', '#F59E0B', '#EF4444']),
      interpolateColor(stateColor.value, [0, 1, 2, 3], ['rgba(201, 151, 76, 0)', 'rgba(255, 255, 255, 0)', 'rgba(245, 158, 11, 0)', 'rgba(239, 68, 68, 0)'])
    ];
  });

  const sweepColors = useDerivedValue(() => {
    const c1 = interpolateColor(stateColor.value, [0, 1, 2, 3], ['rgba(201, 151, 76, 0.1)', 'rgba(255, 255, 255, 0.3)', 'rgba(245, 158, 11, 0.3)', 'rgba(239, 68, 68, 0.3)']);
    const c2 = interpolateColor(stateColor.value, [0, 1, 2, 3], ['rgba(201, 151, 76, 0.8)', 'rgba(255, 255, 255, 0.9)', 'rgba(245, 158, 11, 0.9)', 'rgba(239, 68, 68, 0.9)']);
    return [c1, c2, c1];
  });

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getAccessibilityLabel = (s: OrbState): string => {
    const labels: Record<OrbState, string> = {
      breathing: 'Orion is available. Tap to start talking.',
      listening: 'Orion is listening.',
      thinking: 'Orion is thinking.',
      searching: 'Orion is searching.',
      speaking: 'Orion is speaking. Tap to interrupt.',
      working: 'Orion is working on a task.',
      needs_you: 'Orion needs your approval.',
      error: 'Orion encountered an error.',
    };
    return labels[s];
  };

  const cX = 100;
  const cY = 100;
  const center = vec(cX, cY);

  return (
    <View 
      style={styles.touchContainer}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={getAccessibilityLabel(state)}
      accessibilityState={{ busy: ['thinking', 'searching', 'working'].includes(state) }}
    >
      <Animated.View style={[styles.orbWrapper, animatedOrbStyle]}>
        <Canvas style={{ width: 200, height: 200 }}>
          {/* Layer 1: Diffuse background glow */}
          <Circle c={center} r={80} opacity={glowOpacity}>
            <RadialGradient c={center} r={80} colors={radialColors} />
          </Circle>

          {/* Layer 2: Rotating Ring (Sweep Gradient) */}
          <Group origin={center} transform={useDerivedValue(() => [{ rotate: (ringRotation.value * Math.PI) / 180 }])}>
            <Circle c={center} r={65} style="stroke" strokeWidth={2}>
              <SweepGradient c={center} colors={sweepColors} />
            </Circle>
          </Group>

          {/* Layer 3: Dynamic blur mask (Optional, standard Skia Blur over groups can be heavy, we'll keep it light) */}
          
          {/* Layer 4: Inner concentric ring */}
          <Circle c={center} r={45} style="stroke" strokeWidth={2} color={coreColor} opacity={0.5} />
          
          {/* Layer 5: Inner energy core */}
          <Circle c={center} r={25} color={coreColor}>
             <Blur blur={4} />
          </Circle>
        </Canvas>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  touchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
  },
  orbWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
