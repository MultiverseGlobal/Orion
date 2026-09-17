/**
 * InsightsScreen — Media insights via Clario + Gemini
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Colors } from '../../theme/colors';


export default function InsightsScreen() {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const handleTranscribe = async () => {
    if (!url || !apiKey) {
      setError('Please provide both URL and Gemini API Key.');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult('');
    
    try {
      const clarioUrl = process.env.EXPO_PUBLIC_CLARIO_URL || 'http://192.168.1.100:8000';
      const res = await fetch(`${clarioUrl}/api/v1/insights/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, gemini_api_key: apiKey })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Transcription failed');
      
      setResult(data.insights);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>media insights</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.summarySection}>
          <Text style={styles.sectionLabel}>extract core ideas from video</Text>
          <Text style={{ color: Colors.textSecondary, marginBottom: 16 }}>
            Paste a YouTube or TikTok link. Clario will extract the audio and Gemini will summarize the core ideas so you don't forget.
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Video URL (e.g. https://youtube.com/...)"
            placeholderTextColor={Colors.textMuted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Gemini API Key"
            placeholderTextColor={Colors.textMuted}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
          />
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleTranscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bg} />
            ) : (
              <Text style={styles.buttonText}>Extract Core Ideas</Text>
            )}
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {result ? (
          <View style={styles.insightCard}>
            <Text style={styles.insightIcon}>🧠</Text>
            <Text style={styles.insightHeadline}>Key Takeaways</Text>
            <Text style={styles.insightBody}>{result}</Text>
          </View>
        ) : null}

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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120, // Space for dock
  },
  summarySection: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 12,
    padding: 16,
    color: Colors.textPrimary,
    marginBottom: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: Colors.textPrimary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: Colors.bg,
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: '#EF4444',
    marginTop: 12,
    fontSize: 14,
  },
  insightCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 32,
    padding: 32,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  insightIcon: {
    fontSize: 32,
    marginBottom: 16,
  },
  insightHeadline: {
    fontSize: 22,
    fontWeight: '400',
    color: Colors.textPrimary,
    marginBottom: 12,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  insightBody: {
    fontSize: 15,
    fontWeight: '300',
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
