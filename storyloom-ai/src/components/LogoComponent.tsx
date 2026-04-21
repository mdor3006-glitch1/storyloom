import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import DiamondLoader from './DiamondLoader';

type LogoSize = 'small' | 'medium' | 'large';

const SIZE_CONFIG: Record<LogoSize, { diamond: number; wordmark: number; ai: number }> = {
  small:  { diamond: 20, wordmark: 14, ai: 10 },
  medium: { diamond: 36, wordmark: 22, ai: 14 },
  large:  { diamond: 64, wordmark: 34, ai: 20 },
};

interface Props {
  size?: LogoSize;
  showWordmark?: boolean;
  animated?: boolean;
}

export default function LogoComponent({ size = 'medium', showWordmark = true, animated = true }: Props) {
  const cfg       = SIZE_CONFIG[size];
  const fadeAnim  = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const scaleAnim = useRef(new Animated.Value(animated ? 0.8 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <DiamondLoader size={cfg.diamond} color="#1db954" animated={animated} showSparkles={false} />
      {showWordmark && (
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmark, { fontSize: cfg.wordmark }]}>StoryLoom</Text>
          <Text style={[styles.ai, { fontSize: cfg.ai }]}>AI</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  wordmark:    { fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  ai:          { fontWeight: '900', color: '#1db954', letterSpacing: 1 },
});
