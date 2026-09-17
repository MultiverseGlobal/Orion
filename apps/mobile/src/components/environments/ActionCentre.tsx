import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, SafeAreaView, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useOrionStore } from '../../store/useOrionStore';
import { TOKENS } from '../../constants/tokens';
import { PDS_TYPOGRAPHY } from '../../constants/typography';
import { X } from 'lucide-react-native';
import { fetchActions, ActionItem, approveAction } from '../../services/apiService';
import * as Haptics from 'expo-haptics';

const TABS = [
  { label: 'Needs You', status: 'WAITING_APPROVAL' },
  { label: 'In Progress', status: 'IN_PROGRESS' },
  { label: 'Waiting', status: 'PENDING' },
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'Failed', status: 'FAILED' },
];

export const ActionCentre: React.FC = () => {
  const { environment, back, setOrbState } = useOrionStore();
  const isVisible = environment === 'ACTION_CENTRE';
  
  const [activeTab, setActiveTab] = useState(TABS[0].status);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadActions = useCallback(async () => {
    try {
      const data = await fetchActions('user_ben', activeTab);
      if (data?.actions) {
        setActions(data.actions);
      } else {
        setActions([]);
      }
    } catch (e) {
      console.warn('Failed to load actions', e);
    }
  }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActions();
    setRefreshing(false);
  };

  useEffect(() => {
    if (isVisible) {
      loadActions();
      const interval = setInterval(loadActions, 10000);
      return () => clearInterval(interval);
    }
  }, [isVisible, loadActions]);

  const handleQuickApprove = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setOrbState('working');
    try {
      await approveAction(id);
      await loadActions();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setOrbState('breathing');
  };

  const renderItem = ({ item }: { item: ActionItem }) => (
    <View style={styles.actionCard}>
      <Text style={styles.actionDescription}>{item.description}</Text>
      <View style={styles.metaRow}>
        <View style={styles.toolPill}>
          <Text style={styles.toolPillText}>{item.tool}</Text>
        </View>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {item.status === 'WAITING_APPROVAL' && (
        <TouchableOpacity 
          style={styles.approveButton} 
          onPress={() => handleQuickApprove(item.id)}
        >
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      )}
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
          <Text style={styles.headerTitle}>Action Centre</Text>
          <TouchableOpacity onPress={back} style={styles.closeBtn}>
            <X size={24} color={TOKENS.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TABS.map(tab => (
              <TouchableOpacity 
                key={tab.status} 
                style={[styles.tabButton, activeTab === tab.status && styles.activeTabButton]}
                onPress={() => { setActiveTab(tab.status); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[styles.tabText, activeTab === tab.status && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={actions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TOKENS.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No actions in this category.</Text>
            </View>
          }
        />
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
  listContent: {
    padding: 24,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.muted,
  },
  actionCard: {
    backgroundColor: TOKENS.colors.surfaceHighlight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TOKENS.colors.border,
  },
  actionDescription: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.primary,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolPill: {
    backgroundColor: TOKENS.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toolPillText: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.muted,
    fontSize: 10,
  },
  timestamp: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.muted,
    fontSize: 10,
  },
  approveButton: {
    marginTop: 16,
    backgroundColor: TOKENS.colors.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.bg,
  },
});
