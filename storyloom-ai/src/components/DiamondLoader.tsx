import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';

const GENRE_COLORS: Record<string, string> = {
  Romance:            '#FF69B4',
  Thriller:           '#8B0000',
  Fantasy:            '#FFD700',
  Horror:             '#1B5E20',
  Comedy:             '#FFD700',
  'Sci-Fi':           '#00E5FF',
  Drama:              '#1565C0',
  Brainrot:           '#FF6B6B',
  'Cartoon Characters': '#FF6B6B',
  default:            '#1db954',
};

export function getGenreColor(genre?: string): string {
  return GENRE_COLORS[genre ?? 'default'] ?? GENRE_COLORS.default;
}

interface Props {
  size?: number;
  color?: string;
  animated?: boolean;
  showSparkles?: boolean;
}

export default function DiamondLoader({ size = 80, color = '#1db954', animated = true, showSparkles = true }: Props) {
  const rotation   = useRef(new Animated.Value(0)).current;
  const pulse      = useRef(new Animated.Value(1)).current;
  const sparkle1   = useRef(new Animated.Value(0)).current;
  const sparkle2   = useRef(new Animated.Value(0)).current;
  const sparkle3   = useRef(new Animated.Value(0)).current;
  const sparkle4   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    if (showSparkles) {
      const makeSparkle = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.delay(800),
          ])
        ).start();

      makeSparkle(sparkle1, 0);
      makeSparkle(sparkle2, 400);
      makeSparkle(sparkle3, 800);
      makeSparkle(sparkle4, 1200);
    }
  }, [animated, showSparkles]); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const d = size;
  const innerD = d * 0.7;
  const borderW = d * 0.04;

  return (
    <View style={{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }}>
      {/* Sparkles */}
      {showSparkles && (
        <>
          <Animated.Text style={[styles.sparkle, { opacity: sparkle1, top: -d * 0.08, left: d * 0.35, fontSize: d * 0.18, color }]}>✦</Animated.Text>
          <Animated.Text style={[styles.sparkle, { opacity: sparkle2, top: d * 0.35,  right: -d * 0.08, fontSize: d * 0.14, color }]}>✦</Animated.Text>
          <Animated.Text style={[styles.sparkle, { opacity: sparkle3, bottom: -d * 0.08, left: d * 0.3, fontSize: d * 0.16, color }]}>✦</Animated.Text>
          <Animated.Text style={[styles.sparkle, { opacity: sparkle4, top: d * 0.3,  left: -d * 0.08, fontSize: d * 0.12, color }]}>✦</Animated.Text>
        </>
      )}

      {/* Rotating + pulsing diamond */}
      <Animated.View style={{
        transform: [{ rotate: spin }, { scale: pulse }],
        width: d, height: d,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Diamond body (rotated square) */}
        <View style={{
          width: innerD, height: innerD,
          transform: [{ rotate: '45deg' }],
          backgroundColor: '#1a0040',
          borderWidth: borderW,
          borderColor: color,
          overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Facet layers */}
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: innerD * 0.4,
            backgroundColor: 'rgba(123,47,190,0.6)',
          }} />
          <View style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: innerD * 0.35,
            backgroundColor: `${color}40`,
          }} />
          <View style={{
            position: 'absolute',
            top: innerD * 0.15, left: 0, right: 0,
            height: borderW,
            backgroundColor: `${color}80`,
          }} />
          <View style={{
            position: 'absolute',
            bottom: innerD * 0.2, left: 0, right: 0,
            height: borderW,
            backgroundColor: `${color}60`,
          }} />
          {/* Diagonal facet lines */}
          <View style={{
            position: 'absolute',
            width: borderW, height: innerD * 1.4,
            backgroundColor: `${color}50`,
            transform: [{ rotate: '30deg' }],
            left: innerD * 0.25,
          }} />
          <View style={{
            position: 'absolute',
            width: borderW, height: innerD * 1.4,
            backgroundColor: `${color}30`,
            transform: [{ rotate: '-30deg' }],
            right: innerD * 0.25,
          }} />
          {/* Center highlight */}
          <View style={{
            width: innerD * 0.3, height: innerD * 0.3,
            backgroundColor: 'rgba(255,255,255,0.12)',
            transform: [{ rotate: '0deg' }],
          }} />
        </View>

        {/* SL monogram (counter-rotate so it stays upright) */}
        {size >= 40 && (
          <Animated.Text style={{
            position: 'absolute',
            fontSize: d * 0.18,
            fontWeight: '900',
            color: `${color}CC`,
            letterSpacing: -1,
            transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) }],
          }}>
            SL
          </Animated.Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sparkle: {
    position: 'absolute',
    fontWeight: '900',
  },
});
