import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  color?: string;
  style?: ViewStyle;
}

// Sims-style human silhouettes using React Native Views (no SVG dependency)
function Figure({ color, x, height, variant = 0 }: {
  color: string; x: number; height: number; variant?: number;
}) {
  const headSize = height * 0.18;
  const bodyW = height * 0.22;
  const bodyH = height * 0.35;
  const legH  = height * 0.35;
  const legW  = bodyW * 0.38;
  const armAngle = variant === 2 ? -30 : 0; // arm up for pointing variant

  return (
    <View style={[styles.figure, { left: x, bottom: 0, width: bodyW + 20 }]}>
      {/* Arms */}
      <View style={[styles.arm, {
        backgroundColor: color,
        width: height * 0.06, height: height * 0.28,
        left: 0, top: headSize + height * 0.04,
        transform: variant === 2 ? [{ rotate: '-40deg' }] : [],
      }]} />
      <View style={[styles.arm, {
        backgroundColor: color,
        width: height * 0.06, height: height * 0.28,
        right: 0, top: headSize + height * 0.04,
        transform: variant === 4 ? [{ rotate: '20deg' }] : [],
      }]} />
      {/* Body */}
      <View style={[styles.body, {
        width: bodyW, height: bodyH,
        backgroundColor: color,
        alignSelf: 'center',
        marginTop: headSize * 0.9,
        borderRadius: bodyW * 0.15,
      }]} />
      {/* Legs */}
      <View style={[styles.legs, { width: bodyW + 4, alignSelf: 'center' }]}>
        <View style={[styles.leg, { width: legW, height: legH, backgroundColor: color,
          borderRadius: legW * 0.3,
          transform: variant === 3 ? [{ rotate: '-10deg' }] : [],
        }]} />
        <View style={[styles.leg, { width: legW, height: legH, backgroundColor: color,
          borderRadius: legW * 0.3,
          transform: variant === 3 ? [{ rotate: '10deg' }] : [],
        }]} />
      </View>
      {/* Head */}
      <View style={[styles.head, {
        width: headSize, height: headSize,
        backgroundColor: color,
        borderRadius: headSize / 2,
        alignSelf: 'center',
        position: 'absolute', top: 0,
      }]} />
    </View>
  );
}

export default function SimsSilhouettes({ color = '#000', style }: Props) {
  const BASE_H = 130;
  const figures = [
    { x: 20,  h: BASE_H,         v: 0 },
    { x: 80,  h: BASE_H * 0.85,  v: 1 },
    { x: 150, h: BASE_H * 1.05,  v: 2 },
    { x: 220, h: BASE_H * 0.9,   v: 3 },
    { x: 300, h: BASE_H,         v: 4 },
  ];

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {figures.map((f, i) => (
        <Figure key={i} color={color} x={f.x} height={f.h} variant={f.v} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    opacity: 0.06,
    zIndex: -1,
    overflow: 'hidden',
  },
  figure: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  head: {},
  body: {},
  legs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 0,
  },
  leg: {},
  arm: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: 'currentColor',
  },
  armLeft:  {},
  armRight: {},
});
