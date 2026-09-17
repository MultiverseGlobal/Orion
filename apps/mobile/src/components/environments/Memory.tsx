import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, SafeAreaView, ScrollView, TextInput, RefreshControl, Alert } from 'react-native';
import { useOrionStore } from '../../store/useOrionStore';
import { TOKENS } from '../../constants/tokens';
import { PDS_TYPOGRAPHY } from '../../constants/typography';
import { X, BrainCircuit, Search, Trash2, Info } from 'lucide-react-native';
import { fetchMemoryRecords, MemoryItem, forgetMemory } from '../../services/apiService';
import * as Haptics from 'expo-haptics';

const TABS = [
  { label: 'Goals', id: 'goals' },
  { label: 'Rules', id: 'rules' },
  { label: 'Preferences', id: 'preferences' },
  { label: 'Decisions', id: 'decisions' },
  { label: 'Patterns', id: 'patterns' },
  { label: 'Current State', id: 'current_state' },
];

export const Memory: React.FC = () => {
  const { environment, back } = useOrionStore();
  const isVisible = environment === 'MEMORY';
  
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [refreshing, setRefreshing] = useState(false);

  const loadMemories = useCallback(async () => {
    try {
      const data = await fetchMemoryRecords('user_ben');
      if (data?.records) {
        setMemories(data.records);
      }
    } catch (e) {
      console.warn('Failed to load memories', e);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemories();
    setRefreshing(false);
  };

  useEffect(() => {
    if (isVisible) {
      loadMemories();
    }
  }, [isVisible, loadMemories]);

  const handleForget = (item: MemoryItem) => {
    Alert.alert('Forget Memory', 'Are you sure you want Orion to forget this?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Forget', 
        style: 'destructive',
        onPress: async () => {
          try {
            await forgetMemory(item.table, item.id, 'user_ben');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadMemories();
          } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        }
      }
    ]);
  };

  const filteredMemories = useMemo(() => {
    // Filter by table (which maps to tab id).
    let result = memories.filter(m => m.table === activeTab || (!m.table && activeTab === 'current_state'));
    if (searchQuery.trim()) {
      result = result.filter(m => 
        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return result;
  }, [memories, searchQuery, activeTab]);

  // Split into two columns for simple masonry
  const leftCol: MemoryItem[] = [];
  const rightCol: MemoryItem[] = [];
  filteredMemories.forEach((item, index) => {
    if (index % 2 === 0) leftCol.push(item);
    else rightCol.push(item);
  });

  const MemoryCard = ({ item }: { item: MemoryItem }) => (
    <View style={styles.memoryCard}>
      <BrainCircuit size={20} color={TOKENS.colors.accent} style={styles.icon} />
      <Text style={styles.memoryText}>{item.description}</Text>
      
      {item.confidence !== undefined && (
        <View style={styles.confidenceBarContainer}>
          <View style={[styles.confidenceBar, { width: `${item.confidence * 100}%` }]} />
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{item.scope?.toUpperCase() || (item.importance > 0.8 ? 'CORE' : 'GENERAL')}</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => {/* Inspect feature */}}>
             <Info size={14} color={TOKENS.colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleForget(item)}>
             <Trash2 size={14} color={'#EF4444'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={back}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Orion Memory</Text>
          <TouchableOpacity onPress={back} style={styles.closeBtn}>
            <X size={24} color={TOKENS.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TABS.map(tab => (
              <TouchableOpacity 
                key={tab.id} 
                style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
                onPress={() => { setActiveTab(tab.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={TOKENS.colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search memories..."
            placeholderTextColor={TOKENS.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TOKENS.colors.primary} />}
        >
          {filteredMemories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No memories found in {TABS.find(t => t.id === activeTab)?.label}.</Text>
            </View>
          ) : (
            <View style={styles.masonryGrid}>
              <View style={styles.column}>
                {leftCol.map(item => <MemoryCard key={item.id} item={item} />)}
              </View>
              <View style={styles.column}>
                {rightCol.map(item => <MemoryCard key={item.id} item={item} />)}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderLight,
  },
  headerTitle: {
    ...PDS_TYPOGRAPHY.header3,
    color: TOKENS.colors.primary,
  },
  closeBtn: {
    padding: 8,
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderLight,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: TOKENS.colors.accent,
  },
  tabText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.muted,
  },
  activeTabText: {
    color: TOKENS.colors.accent,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.colors.surfaceHighlight,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.primary,
  },
  content: {
    padding: 24,
    paddingTop: 8,
  },
  masonryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
    marginHorizontal: 6,
  },
  memoryCard: {
    backgroundColor: TOKENS.colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: TOKENS.colors.border,
    marginBottom: 12,
  },
  icon: {
    marginBottom: 8,
  },
  memoryText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.primary,
    marginBottom: 12,
    lineHeight: 22,
  },
  confidenceBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
    backgroundColor: TOKENS.colors.accent,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.muted,
    fontSize: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 6,
    backgroundColor: TOKENS.colors.surface,
    borderRadius: 12,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.muted,
    textAlign: 'center',
  },
});
