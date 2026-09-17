import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, withDelay } from 'react-native-reanimated';
import { LivingOrb } from '../components/LivingOrb';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { useOrionStore } from '../store/useOrionStore';
import { TOKENS } from '../constants/tokens';
import { PDS_TYPOGRAPHY } from '../constants/typography';

const { width } = Dimensions.get('window');

const ONBOARDING_SEQUENCE = [
  {
    id: 'intro',
    orionSays: ["I'm Orion.", "I want to understand how you live, what you're building, and what matters to you.", "Ready?"],
    inputType: 'voice', // or 'pills'
    placeholder: 'speak or type "ready"...'
  },
  {
    id: 'name',
    orionSays: ["What should I call you?"],
    inputType: 'voice',
    placeholder: 'your name...'
  },
  {
    id: 'identity',
    orionSays: ["Who are you striving to become?"],
    inputType: 'voice',
    placeholder: 'architect, creator...'
  },
  {
    id: 'direction',
    orionSays: ["What are you building right now?"],
    inputType: 'voice',
    placeholder: 'your main project...'
  },
  {
    id: 'values',
    orionSays: ["What parts of your life matter most?"],
    inputType: 'voice',
    placeholder: 'family, craft, health...'
  },
  {
    id: 'mentor',
    orionSays: ["What should I call you out on when I notice you drifting?"],
    inputType: 'voice',
    placeholder: 'scrolling, procrastination...'
  },
  {
    id: 'proactivity',
    orionSays: ["How proactive should I be?"],
    inputType: 'pills',
    options: ['Quiet', 'Balanced', 'Proactive']
  },
  {
    id: 'outcome',
    orionSays: ["Give me one thing you want handled."],
    inputType: 'voice',
    placeholder: 'tell me...'
  }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { orbState, voiceState, setVoiceState } = useOrionStore();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputText, setInputText] = useState('');
  
  // Script engine
  const [scriptLineIndex, setScriptLineIndex] = useState(0);
  const [isOrionSpeaking, setIsOrionSpeaking] = useState(false);
  const [isListeningForAnswer, setIsListeningForAnswer] = useState(false);
  const [spokenText, setSpokenText] = useState(''); // Text currently being spoken by Orion

  const textOpacity = useSharedValue(0);

  const currentStep = ONBOARDING_SEQUENCE[step];

  const handleNextStep = useCallback(() => {
    if (step < ONBOARDING_SEQUENCE.length - 1) {
      setStep(s => s + 1);
      setScriptLineIndex(0);
      setInputText('');
      setSpokenText('');
    } else {
      completeOnboarding();
    }
  }, [step]);

  const { speak, startListening, stopListening } = useVoiceSession({
    onTranscript: (text, isFinal) => {
      setInputText(text);
      if (isFinal && text.trim().length > 0) {
        // Auto-advance if voice finishes
        stopListening();
        setAnswers(prev => ({ ...prev, [currentStep.id]: text }));
        setTimeout(handleNextStep, 500);
      }
    }
  });

  // Play script lines
  useEffect(() => {
    if (!currentStep) return;
    const lines = currentStep.orionSays;
    if (scriptLineIndex < lines.length) {
      const line = lines[scriptLineIndex];
      setSpokenText(line);
      setIsOrionSpeaking(true);
      setIsListeningForAnswer(false);
      textOpacity.value = 0;
      textOpacity.value = withTiming(1, { duration: 600 });
      
      // Speak the line
      speak(line);
      
      // Very hacky delay to mimic wait-for-TTS-to-finish without native callbacks mapped easily
      // We know TTS takes approx 1.5s per line. In production, use expo-speech onDone callback properly via voice session hook.
      // For the prototype, we use a simple timeout based on word count.
      const wordCount = line.split(' ').length;
      const ms = Math.max(wordCount * 400 + 800, 2000);
      
      const timer = setTimeout(() => {
        setIsOrionSpeaking(false);
        textOpacity.value = withTiming(0, { duration: 400 });
        setTimeout(() => setScriptLineIndex(idx => idx + 1), 400);
      }, ms);
      return () => clearTimeout(timer);
    } else {
      // Done speaking lines for this step, open mic if voice input expected
      if (currentStep.inputType === 'voice') {
        setIsListeningForAnswer(true);
        setTimeout(() => {
          startListening();
        }, 500);
      }
    }
  }, [step, scriptLineIndex, speak, startListening]);

  const completeOnboarding = async () => {
    speak("I'm here.");
    const portrait = {
      identity: answers.identity || 'Systems Architect',
      proactivity: answers.proactivity || 'Balanced',
      firstOutcome: answers.outcome || 'None',
    };
    await AsyncStorage.setItem('orion_portrait', JSON.stringify(portrait));
    await AsyncStorage.setItem('orion_onboarded', 'true');
    setTimeout(() => {
      router.replace('/');
    }, 2000);
  };

  const handlePillSelect = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentStep.id]: option }));
    handleNextStep();
  };

  const submitText = () => {
    if (inputText.trim()) {
      stopListening();
      setAnswers(prev => ({ ...prev, [currentStep.id]: inputText }));
      handleNextStep();
    }
  };

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: withTiming(textOpacity.value === 1 ? 0 : 10, { duration: 400 }) }]
  }));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.orbContainer}>
        <LivingOrb state={orbState} />
      </View>

      <View style={styles.contentContainer}>
        {/* Orion's speech */}
        <Animated.Text style={[styles.orionText, animatedTextStyle]}>
          {spokenText}
        </Animated.Text>

        {/* User Input Area */}
        {scriptLineIndex >= currentStep.orionSays.length && (
          <View style={styles.inputWrapper}>
            {currentStep.inputType === 'voice' ? (
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={currentStep.placeholder}
                placeholderTextColor={TOKENS.colors.muted}
                onSubmitEditing={submitText}
                autoFocus={true}
                returnKeyType="send"
              />
            ) : (
              <View style={styles.pillsContainer}>
                {currentStep.options?.map(opt => (
                  <TouchableOpacity key={opt} style={styles.pill} onPress={() => handlePillSelect(opt)}>
                    <Text style={styles.pillText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.colors.bg,
  },
  orbContainer: {
    flex: 0.4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  contentContainer: {
    flex: 0.6,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  orionText: {
    ...PDS_TYPOGRAPHY.header2,
    color: TOKENS.colors.primary,
    textAlign: 'center',
    marginBottom: 60,
  },
  inputWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  textInput: {
    ...PDS_TYPOGRAPHY.bodyL,
    color: TOKENS.colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.border,
    paddingVertical: 12,
    width: '100%',
    textAlign: 'center',
  },
  pillsContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: TOKENS.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: TOKENS.colors.border,
  },
  pillText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.primary,
  }
});
