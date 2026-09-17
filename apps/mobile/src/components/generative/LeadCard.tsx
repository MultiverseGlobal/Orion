// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { Plus } from 'lucide-react-native';

interface LeadCardProps {
  data: { name: string; company: string; website?: string };
  onCreateLead: () => void;
}

export function LeadCard({ data, onCreateLead }: LeadCardProps) {
  const translateX = useSharedValue(0);

  const panGestureEvent = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { x: number }
  >({
    onStart: (_, context) => {
      context.x = translateX.value;
    },
    onActive: (event, context) => {
      translateX.value = Math.max(0, event.translationX + context.x);
    },
    onEnd: () => {
      if (translateX.value > 100) {
        translateX.value = withSpring(500);
        runOnJS(onCreateLead)();
      } else {
        translateX.value = withSpring(0);
      }
    },
  });

  const rStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={styles.container}>
      <PanGestureHandler onGestureEvent={panGestureEvent}>
        <Animated.View style={[styles.card, rStyle]}>
          <View style={styles.header}>
            <Text style={styles.name}>{data.name}</Text>
            <Text style={styles.company}>{data.company}</Text>
          </View>
          {data.website && <Text style={styles.website}>{data.website}</Text>}
          <View style={styles.swipeHint}>
            <Text style={styles.swipeText}>Swipe to add lead</Text>
            <Plus size={16} color="#10B981" />
          </View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '90%',
    backgroundColor: '#0F172A', // Obsidian surface
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981', // Emerald accent
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    marginBottom: 8,
  },
  name: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
  },
  company: {
    color: '#94A3B8',
    fontSize: 14,
  },
  website: {
    color: '#38BDF8',
    fontSize: 14,
    marginTop: 4,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
  },
  swipeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
});
