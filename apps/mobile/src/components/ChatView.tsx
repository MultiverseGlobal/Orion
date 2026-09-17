// @ts-nocheck
import { SpringButton } from '../components/SpringButton';
import { Colors } from '../theme/colors';
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput,  Animated } from 'react-native';
import { Disc, ChevronLeft, ArrowUp } from 'lucide-react-native';
import { useOrionStore, AIMessage } from '../store/useOrionStore';

interface ChatViewProps {
  promptText: string;
  setPromptText: (text: string) => void;
  onSubmit: (text: string) => void;
}

export function ChatView({ promptText, setPromptText, onSubmit }: ChatViewProps) {
  const { chatMessages, resetToListening } = useOrionStore();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages]);

const ThinkingIndicator: React.FC = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.thinkingRow, { opacity }]}>
      <Disc size={12} color={Colors.textSecondary} />
      <Text style={styles.searchingText}>Searching memory...</Text>
    </Animated.View>
  );
};

import { LeadCard } from './generative/LeadCard';
import { ProgressRing } from './generative/ProgressRing';

const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === 'user';
    
    // Find associated generative blocks
    const blocks = useOrionStore.getState().generativeBlocks.filter(
      (b) => b.messageId === item.id
    );

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Disc size={14} color={Colors.porcelainCard} />
          </View>
        )}
        <View style={styles.messageContentWrapper}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
            {!isUser && !item.content && (!blocks || blocks.length === 0) ? (
              <ThinkingIndicator />
            ) : (
              <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAI]}>
                {item.content}
              </Text>
            )}
          </View>
          {blocks.map((block) => {
            if (block.type === 'lead_card') {
              return (
                <LeadCard 
                  key={block.id} 
                  data={block.data} 
                  onCreateLead={() => {}} 
                />
              );
            }
            if (block.type === 'progress_ring') {
              return <ProgressRing key={block.id} jobId={block.data.jobId} />;
            }
            return null;
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SpringButton style={styles.backBtn} onPress={resetToListening}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </SpringButton>
      </View>
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      
      <View style={styles.inputWrapper}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Tell Orion what to pull up..."
            placeholderTextColor={Colors.textMuted}
            value={promptText}
            onChangeText={setPromptText}
            onSubmitEditing={() => onSubmit(promptText)}
          />
          <SpringButton
            style={styles.sendBtn}
            onPress={() => onSubmit(promptText)}
          >
            <ArrowUp size={16} color={Colors.porcelainCard} />
          </SpringButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.porcelainSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: Colors.porcelainCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderMedium,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAI: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageContentWrapper: {
    maxWidth: '75%',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  bubbleUser: {
    backgroundColor: Colors.borderMedium,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: Colors.porcelainCard,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: Colors.textPrimary,
  },
  messageTextAI: {
    color: Colors.textPrimary,
  },
  inputWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24, // reduced bottom padding
    backgroundColor: Colors.porcelain,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.porcelainCard,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  searchingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
