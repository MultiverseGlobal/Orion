import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Rect, LinearGradient, vec, Blur } from '@shopify/react-native-skia';
import { TOKENS } from '../../constants/tokens';

interface AtmosphericBackdropProps {
  children?: React.ReactNode;
}

export const AtmosphericBackdrop: React.FC<AtmosphericBackdropProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Ground: Obsidian Void */}
      <View style={styles.ground} />

      {/* Skia Atmosphere (Soft light gradient & Blur) */}
      <Canvas style={StyleSheet.absoluteFillObject}>
        <Rect x={0} y={0} width={4000} height={4000} opacity={0.3}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, 1000)}
            colors={['rgba(255,255,255,0.05)', 'transparent']}
          />
        </Rect>
      </Canvas>

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  ground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TOKENS.colors.bg,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  }
});
