/**
 * Plumbob — The iconic Sims green diamond shape.
 * Used as a loading indicator, logo element, and decorative UI element.
 *
 * Props:
 *   size      — outer bounding box size in dp (default 48)
 *   color     — fill color (default plumbob green)
 *   animated  — if true, pulses with a glowing scale animation
 *   style     — additional View style
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface PlumbobProps {
  size?: number;
  color?: string;
  animated?: boolean;
  style?: ViewStyle;
}

export default function Plumbob({ size = 48, color = colors.plumbob, animated = false, style }: PlumbobProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(glowAnim,  { toValue: 1,    duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
          Animated.timing(glowAnim,  { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [animated, scaleAnim, glowAnim]);

  const diamondSize  = size * 0.64;
  const shadowRadius = size * 0.45;

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size },
        animated && { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      {/* Outer glow halo */}
      {animated && (
        <Animated.View
          style={[
            styles.glow,
            {
              width:  diamondSize * 1.6,
              height: diamondSize * 1.6,
              borderRadius: diamondSize * 0.25,
              backgroundColor: color,
              opacity: glowAnim,
              shadowColor: color,
              shadowRadius: shadowRadius * 1.5,
            },
          ]}
        />
      )}

      {/* Main diamond body */}
      <View
        style={[
          styles.diamond,
          {
            width:        diamondSize,
            height:       diamondSize,
            borderRadius: Math.max(3, size * 0.06),
            backgroundColor: color,
            shadowColor: color,
            shadowRadius: shadowRadius,
          },
        ]}
      />

      {/* Inner highlight — top-left facet */}
      <View
        style={[
          styles.highlight,
          {
            width:        diamondSize * 0.38,
            height:       diamondSize * 0.38,
            borderRadius: Math.max(2, size * 0.04),
            top:  size * 0.18,
            left: size * 0.18,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position:  'absolute',
    transform: [{ rotate: '45deg' }],
    opacity:   0.25,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.9,
    elevation: 0,
  },
  diamond: {
    position:       'absolute',
    transform:      [{ rotate: '45deg' }],
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0.7,
    elevation:      8,
  },
  highlight: {
    position:        'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform:       [{ rotate: '45deg' }],
  },
});
