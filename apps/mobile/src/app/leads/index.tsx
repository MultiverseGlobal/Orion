import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { Target, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

import { fetchLeads } from '../../services/dbService';

export default function LeadsScreen() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const data = await fetchLeads();
      setLeads(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>your leads</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} size="small" color={Colors.textPrimary} />
        ) : (
          <View style={styles.timeline}>
            {leads.length === 0 ? (
              <Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 40 }}>No leads found.</Text>
            ) : (
              leads.map((lead) => (
                <View key={lead.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.tagBadge}>
                      <Target size={14} color="#0B0D08" />
                      <Text style={styles.tagText}>{lead.icp_score}/15 ICP</Text>
                    </View>
                    <Text style={styles.metaText}>{lead.stage}</Text>
                  </View>
                  <Text style={styles.companyText}>{lead.company}</Text>
                  <Text style={styles.prospectText}>{lead.prospect}</Text>
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
  card: { backgroundColor: Colors.sectionTeal, borderRadius: 32, padding: 24, minHeight: 120 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2, color: '#0B0D08' },
  metaText: { fontSize: 12, fontWeight: '500', color: '#0B0D08', opacity: 0.6, textTransform: 'uppercase' },
  companyText: { fontSize: 20, fontWeight: '600', color: '#0B0D08', marginBottom: 4 },
  prospectText: { fontSize: 16, color: '#0B0D08', opacity: 0.8 },
});
