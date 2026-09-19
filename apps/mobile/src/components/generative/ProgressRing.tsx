import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

interface ProgressRingProps {
  jobId: string;
}

export function ProgressRing({ jobId }: ProgressRingProps) {
  const progress = useSharedValue(0); // 0 to 1
  const strokeWidth = 10;
  const radius = 60;
  const center = radius + strokeWidth;
  const size = center * 2;
  
  const path = Skia.Path.Make();
  path.addCircle(center, center, radius);

  useEffect(() => {
    if (!supabase) return;

    // Initial fetch
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('clario_jobs')
        .select('progress_pct')
        .eq('id', jobId)
        .single();
      if (data) {
        progress.value = withTiming(data.progress_pct / 100, { duration: 500, easing: Easing.out(Easing.ease) });
      }
    };
    fetchStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`clario_jobs_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clario_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (payload.new && payload.new.progress_pct !== undefined) {
            progress.value = withTiming(payload.new.progress_pct / 100, { duration: 500, easing: Easing.out(Easing.ease) });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return (
    <View style={styles.container}>
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={path}
          style="stroke"
          strokeWidth={strokeWidth}
          color="rgba(0, 240, 255, 0.2)"
        />
        <Path
          path={path}
          style="stroke"
          strokeWidth={strokeWidth}
          color="#00f0ff"
          start={0}
          end={progress}
          strokeCap="round"
        />
      </Canvas>
      <Text style={styles.text}>Processing Video...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  text: {
    marginTop: 12,
    color: '#00f0ff',
    fontSize: 14,
    fontWeight: '600',
  }
});
