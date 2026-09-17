import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useOrionStore } from '../store/useOrionStore';
import { TOKENS } from '../constants/tokens';
import { PDS_TYPOGRAPHY } from '../constants/typography';

export const TransientSpeech: React.FC = () => {
  const { transientSpeech, voiceState } = useOrionStore();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    if (transientSpeech && (voiceState === 'PLAYING' || voiceState === 'LISTENING')) {
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      translateY.value = withDelay(300, withTiming(10, { duration: 0 }));
    }
  }, [transientSpeech, voiceState, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Render unconditionally but animate opacity, to avoid layout thrashing
  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <Animated.Text 
        style={[
          styles.text, 
          { color: voiceState === 'LISTENING' ? TOKENS.colors.muted : TOKENS.colors.primary }
        ]} 
        numberOfLines={2}
      >
        {transientSpeech || ' '}
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: '15%',
    left: 40,
    right: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...PDS_TYPOGRAPHY.bodyL,
    color: TOKENS.colors.muted,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
