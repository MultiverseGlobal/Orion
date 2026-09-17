import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionStore } from '../store/useOrionStore';
import { LivingOrb } from '../components/LivingOrb';
import { TransientSpeech } from '../components/TransientSpeech';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { TOKENS } from '../constants/tokens';
import { TextMode } from '../components/environments/TextMode';
import { NeedsYou } from '../components/environments/NeedsYou';
import { ActionCentre } from '../components/environments/ActionCentre';
import { Memory } from '../components/environments/Memory';
import { Journey } from '../components/environments/Journey';
import { ProactivePresenceManager } from '../components/ProactivePresenceManager';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { orbState, voiceState, setTransientSpeech, navigate } = useOrionStore();

  const { startListening, stopListening, cancelSpeech } = useVoiceSession({
    onTranscript: (text, isFinal) => {
      // Echo user speech to transient speech while they talk, then clear when done
      setTransientSpeech(text);
      if (isFinal) {
        setTimeout(() => setTransientSpeech(null), 1000);
      }
    },
    onServerResponse: (reply) => {
      setTransientSpeech(reply);
    }
  });

  const handleOrbTap = () => {
    if (orbState === 'speaking') {
      cancelSpeech();
      startListening();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (voiceState === 'LISTENING') {
      stopListening();
    } else {
      startListening();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Swipe up gesture -> Text Mode
  const panGesture = Gesture.Pan()
    .onEnd((e) => {
      if (e.translationY < -80) { // Swipe up threshold
        runOnJS(navigate)('TEXT_MODE');
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

  // Long press gesture on orb -> Action Centre
  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      runOnJS(navigate)('ACTION_CENTRE');
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
    });

  // Tap gesture on orb
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(handleOrbTap)();
    });

  // Composed gesture (tap + long press on orb)
  const orbGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={TOKENS.colors.bg} />
        
        <View style={styles.canvas}>
          <GestureDetector gesture={orbGesture}>
            <View>
              <LivingOrb state={orbState} />
            </View>
          </GestureDetector>
        </View>

        <TransientSpeech />
        
        {/* Invisible manager */}
        <ProactivePresenceManager />
        
        {/* Environments */}
        <TextMode />
        <NeedsYou />
        <ActionCentre />
        <Memory />
        <Journey />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.colors.bg,
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});