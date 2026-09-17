import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetTextInput, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Animated, { withRepeat, withSequence, withTiming, useSharedValue, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { useOrionStore } from '../../store/useOrionStore';
import { TOKENS } from '../../constants/tokens';
import { PDS_TYPOGRAPHY } from '../../constants/typography';
import { sendMessage } from '../../services/apiService';
import { Mic, Send, ChevronLeft } from 'lucide-react-native';
import { useVoiceSession } from '../../hooks/useVoiceSession';

export const TextMode: React.FC = () => {
  const { environment, back, setOrbState } = useOrionStore();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'orion', text: string}[]>([
    { role: 'orion', text: "I'm listening." }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const isVisible = environment === 'TEXT_MODE';

  const miniOrbScale = useSharedValue(1);
  const miniOrbOpacity = useSharedValue(0.6);

  useEffect(() => {
    miniOrbScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
    miniOrbOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
  }, []);

  const animatedMiniOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: miniOrbScale.value }],
    opacity: miniOrbOpacity.value,
  }));

  const { startListening, stopListening } = useVoiceSession({
    onTranscript: (text, isFinal) => {
      setInput(text);
      if (isFinal) {
        stopListening();
      }
    }
  });

  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible]);

  const handleSheetChange = (index: number) => {
    if (index === -1 && isVisible) {
      back();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const userText = input.trim();
    setInput('');
    
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsThinking(true);
    
    setOrbState('thinking');
    back();

    const response = await sendMessage('user_ben', userText, 'chat');
    setIsThinking(false);
    
    if (response?.data?.reply) {
      setMessages(prev => [...prev, { role: 'orion', text: response.data.reply }]);
      setOrbState('breathing');
    } else {
      setMessages(prev => [...prev, { role: 'orion', text: "I'm sorry, I couldn't process that right now." }]);
      setOrbState('error');
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['90%']}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.indicator}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={back} style={styles.backBtn}>
            <ChevronLeft size={24} color={TOKENS.colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Animated.View style={[styles.miniOrb, animatedMiniOrbStyle]} />
            <Text style={styles.headerTitle}>Orion</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <BottomSheetFlatList
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble, 
              item.role === 'user' ? styles.userBubble : styles.orionBubble
            ]}>
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
          )}
          ListFooterComponent={
            isThinking ? (
              <View style={[styles.messageBubble, styles.orionBubble]}>
                <Text style={styles.thinkingText}>Thinking...</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.iconButton} onPress={startListening}>
            <Mic size={20} color={TOKENS.colors.muted} />
          </TouchableOpacity>
          <BottomSheetTextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Message Orion..."
            placeholderTextColor={TOKENS.colors.muted}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.iconButton} onPress={handleSend} disabled={!input.trim()}>
            <Send size={20} color={input.trim() ? TOKENS.colors.primary : TOKENS.colors.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderLight,
  },
  backBtn: {
    padding: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniOrb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TOKENS.colors.accent,
    shadowColor: TOKENS.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  headerTitle: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.muted,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: TOKENS.colors.surfaceHighlight,
    borderBottomRightRadius: 4,
  },
  orionBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
  },
  messageText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.primary,
  },
  thinkingText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.muted,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderLight,
    backgroundColor: TOKENS.colors.surface,
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.primary,
    backgroundColor: TOKENS.colors.surfaceHighlight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
