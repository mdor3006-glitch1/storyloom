import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, useWindowDimensions, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import { AuthStackParamList } from '../navigation/AuthStack';

type Nav = StackNavigationProp<AuthStackParamList, 'Onboarding'>;

const SLIDES = [
  {
    key: 'credits',
    emoji: '💎',
    title: 'Credits power your stories',
    body: 'You start with 100 free credits — enough for a full medium story. Buy more packs whenever you need them. Short (50), Medium (100), Long (175).',
  },
  {
    key: 'characters',
    emoji: '📸',
    title: 'Your face, your character',
    body: 'Upload two photos of real people and name them. Our AI keeps their faces consistent across every scene using FLUX image technology.',
  },
  {
    key: 'stories',
    emoji: '📖',
    title: 'Infinite unique stories',
    body: 'Pick a genre, set the tone, make choices — every story is generated live just for you. Stories are saved for 10 days. Favourite them to keep forever.',
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const setHasOnboarded = useAuthStore((s) => s.setHasOnboarded);
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  function goNext() {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      finish();
    }
  }

  function finish() {
    setHasOnboarded();
    navigation.replace('Auth');
  }

  return (
    <View style={styles.screen}>
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>
            {index < SLIDES.length - 1 ? 'Next →' : 'Get Started →'}
          </Text>
        </TouchableOpacity>
        {index < SLIDES.length - 1 && (
          <TouchableOpacity onPress={finish} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#2E4057', textAlign: 'center', marginBottom: 16, lineHeight: 32 },
  body: { fontSize: 16, color: '#6B7C93', textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DCE4EB' },
  dotActive: { width: 24, backgroundColor: '#048A81' },
  footer: { paddingHorizontal: 24, paddingBottom: 48 },
  nextBtn: {
    backgroundColor: '#048A81',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 15, color: '#A0AEBA' },
});
