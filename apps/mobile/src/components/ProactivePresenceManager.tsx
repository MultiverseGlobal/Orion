import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useOrionStore } from '../store/useOrionStore';
import { fetchOrientation } from '../services/apiService';
import * as Speech from 'expo-speech';

export const ProactivePresenceManager: React.FC = () => {
  const { navigate, setOrbState } = useOrionStore();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    // Only poll if we are in a safe mode (e.g. LIVING_MODE)
    const env = useOrionStore.getState().environment;
    const voiceState = useOrionStore.getState().voiceState;
    if (env !== 'LIVING_MODE') return;

    try {
      const data = await fetchOrientation();
      if (!data?.success) return;

      if (data.pendingApprovals?.length > 0) {
        setOrbState('needs_you');
        navigate('NEEDS_YOU');
      } else if (data.proactiveSpeech && voiceState === 'IDLE') {
        setOrbState('speaking');
        Speech.speak(data.proactiveSpeech.text, {
          language: 'en-US',
          onDone: () => setOrbState('breathing'),
        });
      }
    } catch (err) {
      console.warn('[ProactivePresenceManager] poll error:', err);
    }
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        poll();
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(poll, 30000); // 30s
        }
      } else {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initial start
    if (AppState.currentState === 'active') {
      poll();
      pollIntervalRef.current = setInterval(poll, 30000);
    }

    return () => {
      subscription.remove();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return null;
};
