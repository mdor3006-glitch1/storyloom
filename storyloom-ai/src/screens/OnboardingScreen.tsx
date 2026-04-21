import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, useWindowDimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import Plumbob from '../components/Plumbob';
import SimsSilhouettes from '../components/SimsSilhouettes';

const SLIDES = [
  {
    key: 'rules',
    title: 'Your Story.\nYour Rules.',
    subtitle: 'Create cinematic stories powered by AI. Your characters. Your choices. Infinite possibilities.',
    accent: colors.plumbob,
    plumbobColor: colors.plumbob,
    showPlumbob: true,
  },
  {
    key: 'characters',
    title: 'Real Characters.\nReal Emotions.',
    subtitle: 'Build your characters your way. The AI remembers every choice and every emotion throughout your story.',
    accent: '#3b82f6',
    plumbobColor: '#3b82f6',
    showPlumbob: false,
    icon: '🎭',
  },
  {
    key: 'credits',
    title: '100 Free Credits.\nOn Us.',
    subtitle: 'Your first story is completely free. Short, medium, or long — you choose.',
    accent: colors.plumbob,
    plumbobColor: colors.plumbob,
    showPlumbob: true,
    isCTA: true,
  },
];

export default function OnboardingScreen() {
  const setHasOnboarded = useAuthStore((s) => s.setHasOnboarded);
  const { width } = useWindowDimensions();
  const insets   = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const flatRef  = useRef<FlatList>(null);
  const scrollX  = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(btnPulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(btnPulse, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    );
    if (index === SLIDES.length - 1) loop.start();
    else loop.stop();
    return () => loop.stop();
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function goNext() {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      setHasOnboarded();
    }
  }

  const current = SLIDES[index];

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <SimsSilhouettes color={current.accent} />

      {/* Background accent */}
      <View style={[styles.bgAccent, { backgroundColor: current.accent + '12' }]} />

      {/* Skip button */}
      {index < SLIDES.length - 1 && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 12 }]}
          onPress={() => setHasOnboarded()}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={s => s.key}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            {/* Icon area */}
            <View style={styles.iconArea}>
              {item.showPlumbob ? (
                <Plumbob size={96} animated color={item.plumbobColor} />
              ) : (
                <View style={[styles.iconOrb, { borderColor: item.accent + '30' }]}>
                  <Text style={styles.iconEmoji}>{item.icon ?? '📖'}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            <View style={[styles.accentLine, { backgroundColor: item.accent }]} />
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <Animated.View key={i} style={[
            styles.dot,
            i === index && { width: 28, backgroundColor: current.accent },
          ]} />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <Animated.View style={[
          { transform: [{ scale: current.isCTA ? btnPulse : btnScale }] },
        ]}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: current.accent }]}
            onPress={goNext}
            activeOpacity={0.88}
          >
            {index === SLIDES.length - 1
              ? <><Plumbob size={20} color="#fff" /><Text style={styles.ctaBtnText}>Start My Story →</Text></>
              : <Text style={styles.ctaBtnText}>Next  →</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bg },
  bgAccent:  { position: 'absolute', top: -100, left: -80, right: -80, height: 400, borderRadius: 200 },
  skipBtn:   { position: 'absolute', right: 20, zIndex: 10, padding: 8 },
  skipText:  { fontSize: 14, color: colors.textMuted, fontWeight: '500' },

  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingTop: 60,
  },
  iconArea: { marginBottom: 40, alignItems: 'center', justifyContent: 'center', height: 120 },
  iconOrb: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.04)',
  },
  iconEmoji: { fontSize: 52 },

  slideTitle: {
    fontSize: 32, fontWeight: '900', textAlign: 'center',
    lineHeight: 40, letterSpacing: -0.5, marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 15, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },
  accentLine: { width: 44, height: 3, borderRadius: 1.5, marginTop: 28 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(15,23,42,0.15)',
  },

  footer: { paddingHorizontal: 28, paddingBottom: 24 },
  ctaBtn: {
    borderRadius: 20, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 10,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 7,
  },
  ctaBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
});
