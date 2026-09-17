// @ts-nocheck
import React, { useEffect } from 'react';
import { Canvas, Circle, SweepGradient, vec, BlurMask, Group, Transform } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, Easing, useDerivedValue } from 'react-native-reanimated';
import { Colors } from '../theme/colors';

export function OrionLogo({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animated) {
      rotation.value = withRepeat(
        withTiming(Math.PI * 2, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      );
      scale.value = withRepeat(
        withTiming(1.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      rotation.value = 0;
      scale.value = 1;
    }
  }, [animated]);

  const center = size / 2;
  const radius = (size / 2) * 0.75;

  const transform = useDerivedValue(() => {
    return [{ rotate: rotation.value }, { scale: scale.value }];
  });

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group origin={vec(center, center)} transform={transform}>
        <Circle c={vec(center, center)} r={radius}>
          <SweepGradient
            c={vec(center, center)}
            colors={[Colors.accent, '#A7D129', Colors.sectionTeal, Colors.accent]}
          />
          <BlurMask blur={8} style="normal" />
        </Circle>
        
        {/* Core highlight */}
        <Circle c={vec(center - size*0.1, center - size*0.1)} r={radius * 0.4} color="#FFF">
          <BlurMask blur={4} style="normal" />
        </Circle>
      </Group>
    </Canvas>
  );
}
