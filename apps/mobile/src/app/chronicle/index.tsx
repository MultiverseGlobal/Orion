/**
 * JournalScreen (Chronicle) — Pillowtalk testimonial-card timeline
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Clock, MessageCircle, Mic, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';

import { fetchDrafts } from '../../services/dbService';

export default function JournalScreen() {
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const data = await fetchDrafts();
      setDrafts(data);
      setLoading(false);
    }
    load();
  }, []);

  const getTagIcon = (tag: string, color: string) => {
    switch (tag) {
      case 'clarity': return <Star size={14} color={color} />;
      case 'idea': return <MessageCircle size={14} color={color} />;
      default: return <Mic size={14} color={color} />;
    }
  };

  const colors = [Colors.sectionTeal, Colors.sectionLavender, Colors.sectionSage, Colors.sectionPeach];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>your context</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} size="small" color={Colors.textPrimary} />
        ) : (
          <View style={styles.timeline}>
            {drafts.length === 0 ? (
              <Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 40 }}>No drafts found.</Text>
            ) : (
              drafts.map((entry, idx) => {
                const textColor = '#0B0D08';
                const cardColor = colors[idx % colors.length];
                
                return (
                  <View key={entry.id} style={[styles.card, { backgroundColor: cardColor }]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.tagBadge}>
                        {getTagIcon('idea', textColor)}
                        <Text style={[styles.tagText, { color: textColor }]}>
                          Draft
                        </Text>
                      </View>
                      <View style={styles.metaData}>
                        <Text style={[styles.metaText, { color: textColor }]}>{new Date(entry.last_edited || entry.created_at).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <Text style={[styles.entryText, { color: textColor }]}>{entry.title}</Text>
                    <Text style={[styles.entryText, { color: textColor, fontSize: 14, opacity: 0.8, marginTop: 8 }]}>"{entry.content?.substring(0, 100)}..."</Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120, // Space for dock
  },
  timeline: {
    gap: 16,
  },
  card: {
    borderRadius: 32,
    padding: 24,
    minHeight: 140,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  metaData: {
    opacity: 0.6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  entryText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
});
