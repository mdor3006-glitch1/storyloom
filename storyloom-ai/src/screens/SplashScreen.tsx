import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AuthStack';
import { colors } from '../theme/colors';
import Plumbob from '../components/Plumbob';
import DiamondLoader from '../components/DiamondLoader';

type Nav = StackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation   = useNavigation<Nav>();
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoScale    = useRef(new Animated.Value(0.75)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;
  const plumbobScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Plumbob bounces in first
    Animated.spring(plumbobScale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }).start();

    // Then logo fades in
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(logoScale,  { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(tagOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 300);

    const timer = setTimeout(() => navigation.replace('Auth'), 2400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.screen}>
      {/* Background glows */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      {/* Logo area */}
      <Animated.View style={[styles.logoWrap, {
        opacity: logoOpacity,
        transform: [{ scale: logoScale }],
      }]}>
        {/* Plumbob above the wordmark */}
        <Animated.View style={{ transform: [{ scale: plumbobScale }] }}>
          <DiamondLoader size={100} animated showSparkles />
        </Animated.View>

        <View style={styles.wordmark}>
          <Text style={styles.wordmarkStory}>STORY</Text>
          <Text style={styles.wordmarkLoom}>LOOM</Text>
        </View>
        <View style={styles.greenLine} />
        <Text style={styles.aiLabel}>AI</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
        Your story. Your face. Infinite possibilities.
      </Animated.Text>

      {/* Bottom dots */}
      <View style={styles.dotsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  bgGlow1: {
    position: 'absolute',
    top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(29,185,84,0.15)',
  },
  bgGlow2: {
    position: 'absolute',
    bottom: -60, left: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(4,138,129,0.10)',
  },

  logoWrap: { alignItems: 'center', gap: 6 },
  wordmark: { flexDirection: 'row', gap: 2, marginTop: 14 },
  wordmarkStory: {
    fontSize: 34, fontWeight: '900',
    color: '#FFFFFF', letterSpacing: 7,
  },
  wordmarkLoom: {
    fontSize: 34, fontWeight: '900',
    color: colors.plumbob, letterSpacing: 7,
  },
  greenLine: { width: 72, height: 2, backgroundColor: colors.plumbob },
  aiLabel: {
    fontSize: 12, fontWeight: '800',
    color: colors.plumbob, letterSpacing: 6,
  },

  tagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4, textAlign: 'center',
    paddingHorizontal: 52,
  },

  dotsRow: { position: 'absolute', bottom: 52, flexDirection: 'row', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  dotActive: { width: 22, backgroundColor: colors.plumbob },
});
