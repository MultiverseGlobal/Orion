import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { Briefcase, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

import { fetchDeals } from '../../services/dbService';

export default function PipelineScreen() {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const data = await fetchDeals();
      setDeals(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>your pipeline</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} size="small" color={Colors.textPrimary} />
        ) : (
          <View style={styles.timeline}>
            {deals.length === 0 ? (
              <Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 40 }}>No deals found.</Text>
            ) : (
              deals.map((deal) => (
                <View key={deal.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.tagBadge}>
                      <Briefcase size={14} color="#0B0D08" />
                      <Text style={styles.tagText}>${deal.deal_value?.toLocaleString() || '0'}</Text>
                    </View>
                    <Text style={styles.metaText}>{deal.stage}</Text>
                  </View>
                  <Text style={styles.companyText}>{deal.company}</Text>
                  <Text style={styles.prospectText}>{deal.close_date ? `Target Close: ${new Date(deal.close_date).toLocaleDateString()}` : 'No close date'}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { height: 60, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 16 },
  headerTitle: { fontSize: 24, fontWeight: '300', color: Colors.textPrimary, letterSpacing: -0.5 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  timeline: { gap: 16 },
  card: { backgroundColor: Colors.sectionLavender, borderRadius: 32, padding: 24, minHeight: 120 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2, color: '#0B0D08' },
  metaText: { fontSize: 12, fontWeight: '500', color: '#0B0D08', opacity: 0.6, textTransform: 'uppercase' },
  companyText: { fontSize: 20, fontWeight: '600', color: '#0B0D08', marginBottom: 4 },
  prospectText: { fontSize: 14, color: '#0B0D08', opacity: 0.8 },
});
