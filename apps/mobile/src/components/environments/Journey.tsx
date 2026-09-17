import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, SafeAreaView, SectionList, RefreshControl } from 'react-native';
import { useOrionStore } from '../../store/useOrionStore';
import { TOKENS } from '../../constants/tokens';
import { PDS_TYPOGRAPHY } from '../../constants/typography';
import { X, Navigation, CircleDashed, Wrench, BrainCircuit, MessageSquare } from 'lucide-react-native';
import { fetchJourneyData, JourneyEvent } from '../../services/apiService';

export const Journey: React.FC = () => {
  const { environment, back } = useOrionStore();
  const isVisible = environment === 'JOURNEY';

  const [sectionsData, setSectionsData] = useState<{ title: string; data: any[] }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadJourney = async () => {
    try {
      const data = await fetchJourneyData('user_ben');
      if (data) {
        const outcomes = data.outcomes?.events || [];
        const records = data.overview?.records || [];

        // Map data to the 4 spec sections
        const direction = records.filter((r: any) => r.table === 'goals').map((r: any) => ({
          ...r, type: 'direction', title: r.description, description: r.content || 'Long-term outcome'
        }));
        
        const development = outcomes.filter((e: any) => e.type === 'development' || e.status === 'IN_PROGRESS');
        
        const evidence = outcomes.filter((e: any) => e.type !== 'development' && e.status !== 'IN_PROGRESS');
        
        const tensions = records.filter((r: any) => r.table === 'patterns' && (r.importance > 0.7 || r.description?.toLowerCase().includes('conflict'))).map((r: any) => ({
          ...r, type: 'tension', title: r.description, description: r.content || 'Observed tension'
        }));

        const newSections = [
          { title: 'Direction', data: direction },
          { title: 'Current Development', data: development },
          { title: 'Evidence', data: evidence },
          { title: 'Tensions', data: tensions }
        ].filter(section => section.data.length > 0);

        setSectionsData(newSections);
      }
    } catch (e) {
      console.warn('Failed to load journey', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJourney();
    setRefreshing(false);
  };

  useEffect(() => {
    if (isVisible) {
      loadJourney();
    }
  }, [isVisible]);

  const getIconForType = (type: string = '') => {
    switch (type.toLowerCase()) {
      case 'tool': return <Wrench size={16} color={TOKENS.colors.accent} />;
      case 'memory': return <BrainCircuit size={16} color={TOKENS.colors.accent} />;
      case 'chat': return <MessageSquare size={16} color={TOKENS.colors.accent} />;
      case 'direction': return <Navigation size={16} color={TOKENS.colors.accent} />;
      case 'tension': return <CircleDashed size={16} color={'#EF4444'} />;
      default: return <CircleDashed size={16} color={TOKENS.colors.accent} />;
    }
  };

  const renderItem = ({ item, index, section }: { item: any; index: number; section: any }) => (
    <View style={styles.eventRow}>
      <View style={styles.timelineCol}>
        {getIconForType(item.type)}
        {index < section.data.length - 1 && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.contentCol}>
        {item.created_at && (
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </Text>
        )}
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDescription}>{item.description}</Text>
        {item.reasoning && (
          <View style={styles.reasoningBox}>
            <Text style={styles.reasoningText}>{item.reasoning}</Text>
          </View>
        )}
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
          <Text style={styles.headerTitle}>Journey</Text>
          <TouchableOpacity onPress={back} style={styles.closeBtn}>
            <X size={24} color={TOKENS.colors.primary} />
          </TouchableOpacity>
        </View>

        <SectionList
          sections={sectionsData}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TOKENS.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Orion hasn't observed enough to build your Journey yet. Speak with Orion or take action to begin.</Text>
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
  content: {
    padding: 24,
  },
  sectionHeader: {
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    ...PDS_TYPOGRAPHY.header4,
    color: TOKENS.colors.primary,
  },
  eventRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: TOKENS.colors.borderLight,
    marginTop: 4,
    marginBottom: 0, 
  },
  contentCol: {
    flex: 1,
    paddingBottom: 24,
  },
  timestamp: {
    ...PDS_TYPOGRAPHY.labelMono,
    color: TOKENS.colors.muted,
    marginBottom: 6,
  },
  eventTitle: {
    ...PDS_TYPOGRAPHY.bodyL,
    color: TOKENS.colors.primary,
    marginBottom: 4,
    fontWeight: '600',
  },
  eventDescription: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.muted,
    marginBottom: 12,
  },
  reasoningBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: TOKENS.colors.accent,
  },
  reasoningText: {
    ...PDS_TYPOGRAPHY.bodyS,
    color: TOKENS.colors.muted,
    fontStyle: 'italic',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    ...PDS_TYPOGRAPHY.bodyM,
    color: TOKENS.colors.muted,
  },
});
