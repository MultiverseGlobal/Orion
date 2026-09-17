// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../theme/colors';
import { OrionLogo } from '../components/OrionLogo';

type VerdictType = 'WORTH YOUR TIME' | 'MAYBE' | 'NOT WORTH YOUR TIME';

interface Result {
  score: VerdictType;
  about: string;
  reality: string;
  useful_part: string;
  source: string;
  time_saved: string;
  verdict: string;
}

export default function TimeWorthScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!url) {
      router.back();
      return;
    }

    async function analyze() {
      try {
        const res = await fetch('http://127.0.0.1:54321/functions/v1/time-worth-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        setResult(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    analyze();
  }, [url]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <OrionLogo size={120} />
        <Text style={styles.loadingText}>Checking this for you...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Failed to analyze.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 24 }}>
          <Text style={{ color: Colors.text }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const scoreColor = 
    result.score === 'WORTH YOUR TIME' ? '#22c55e' : 
    result.score === 'MAYBE' ? '#f59e0b' : '#ef4444';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
      <View style={[styles.verdictBanner, { borderColor: scoreColor }]}>
        <Text style={[styles.verdictText, { color: scoreColor }]}>
          {result.score === 'WORTH YOUR TIME' ? '🟢' : result.score === 'MAYBE' ? '🟡' : '🔴'} {result.score}
        </Text>
        <Text style={styles.verdictHeadline}>{result.verdict}</Text>
      </View>

      <Text style={styles.sectionTitle}>What it's actually about</Text>
      <Text style={styles.bodyText}>{result.about}</Text>

      <Text style={styles.sectionTitle}>The reality</Text>
      <Text style={styles.bodyText}>{result.reality}</Text>

      <Text style={styles.sectionTitle}>The useful part</Text>
      <Text style={styles.bodyText}>{result.useful_part}</Text>

      <View style={styles.metaRow}>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Source</Text>
          <Text style={styles.metaValue}>{result.source}</Text>
        </View>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Time saved</Text>
          <Text style={styles.metaValue}>{result.time_saved}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.buttonPrimary} onPress={() => router.back()}>
          <Text style={styles.buttonTextPrimary}>Done</Text>
        </Pressable>
        <Pressable style={styles.buttonGhost}>
          <Text style={styles.buttonTextGhost}>Read Source</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 16, marginTop: 24 },
  container: { flex: 1, backgroundColor: Colors.bg },
  verdictBanner: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 24,
    marginTop: 48,
  },
  verdictText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  verdictHeadline: { fontSize: 24, color: Colors.text, fontStyle: 'italic' },
  sectionTitle: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  bodyText: { fontSize: 16, color: Colors.text, lineHeight: 24 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 32 },
  metaBox: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  metaLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  metaValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 48 },
  buttonPrimary: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: Colors.text, alignItems: 'center' },
  buttonTextPrimary: { color: Colors.bg, fontSize: 14, fontWeight: '600' },
  buttonGhost: { flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  buttonTextGhost: { color: Colors.text, fontSize: 14, fontWeight: '600' },
});
