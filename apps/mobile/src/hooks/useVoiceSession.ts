import { useEffect, useCallback, useRef } from 'react';
import * as Speech from 'expo-speech';
import ExpoSpeechRecognitionModule, { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useOrionStore } from '../store/useOrionStore';
import { sendMessage } from '../services/apiService';

export function useVoiceSession({
  onTranscript,
  onServerResponse,
}: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onServerResponse?: (reply: string) => void;
}) {
  const { voiceState, setVoiceState } = useOrionStore();
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTranscriptRef = useRef<string>('');
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  useSpeechRecognitionEvent('start', () => {
    setVoiceState('LISTENING');
  });

  useSpeechRecognitionEvent('end', () => {
    if (useOrionStore.getState().voiceState === 'LISTENING') {
      setVoiceState('IDLE');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('[VoiceSession] Speech recognition error', event.error, event.message);
    setVoiceState('ERROR');
    setTimeout(() => setVoiceState('IDLE'), 2000);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const results = event.results;
    if (!results || results.length === 0) return;

    let interimTranscript = '';
    let finalTranscript = '';

    for (const result of results) {
      if ((result as any).isFinal) {
        finalTranscript += result.transcript;
      } else {
        interimTranscript += result.transcript;
      }
    }

    const isFinal = finalTranscript.length > 0;
    const text = isFinal ? finalTranscript : interimTranscript;

    if (text) {
      currentTranscriptRef.current = text;
      onTranscript(text, isFinal);
    }

    // Auto-detect speech pauses (> 1.6s) to end user turn
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      stopListening();
    }, 1600);
  });

  const cancelSpeech = useCallback(() => {
    Speech.stop();
    const currentState = useOrionStore.getState().voiceState;
    if (currentState === 'PLAYING') {
      setVoiceState('IDLE');
    }
  }, [setVoiceState]);

  const startListening = useCallback(async () => {
    const currentState = useOrionStore.getState().voiceState;
    if (currentState === 'PLAYING') {
      cancelSpeech();
    }
    
    setVoiceState('LISTENING');
    try {
      await (ExpoSpeechRecognitionModule as any).requestPermissionsAsync();
      (ExpoSpeechRecognitionModule as any).start({
        lang: 'en-US',
        interimResults: true,
        continuous: false, // End when user stops speaking (handled by timeout)
      });
    } catch (e) {
      console.error('[VoiceSession] Error starting recognition', e);
      setVoiceState('ERROR');
      setTimeout(() => setVoiceState('IDLE'), 2000);
    }
  }, [setVoiceState, cancelSpeech]);

  const speak = useCallback((text: string) => {
    cancelSpeech();
    setVoiceState('PLAYING');
    Speech.speak(text, {
      language: 'en-US',
      // voice: 'com.apple.ttsbundle.siri_male_en-US_compact', // Optional: find a good default
      onDone: () => {
        setVoiceState('IDLE');
      },
      onError: (e) => {
        console.error('[VoiceSession] TTS error', e);
        setVoiceState('ERROR');
        setTimeout(() => setVoiceState('IDLE'), 2000);
      }
    });
  }, [cancelSpeech, setVoiceState]);

  const submitVoiceTurn = useCallback(async (text: string) => {
    if (!text) {
      setVoiceState('IDLE');
      return;
    }
    setVoiceState('PROCESSING');
    try {
      const response = await sendMessage('user_ben', text, 'voice');
      if (response?.data?.reply) {
        if (onServerResponse) onServerResponse(response.data.reply);
        speak(response.data.reply);
      } else {
        setVoiceState('IDLE');
      }
    } catch (e) {
      console.error('[VoiceSession] Server interact error:', e);
      setVoiceState('ERROR');
      setTimeout(() => setVoiceState('IDLE'), 2000);
    }
  }, [setVoiceState, speak, onServerResponse]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const currentState = useOrionStore.getState().voiceState;
    if (currentState === 'LISTENING') {
      (ExpoSpeechRecognitionModule as any).stop();
      submitVoiceTurn(currentTranscriptRef.current);
      currentTranscriptRef.current = '';
    }
  }, [setVoiceState, submitVoiceTurn]);

  return {
    state: voiceState,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
}
