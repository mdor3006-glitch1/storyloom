import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Animated, Share, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Image } from 'expo-image';
import { StoryStackParamList } from '../navigation/MainStack';
import { useStoryStore } from '../store/storyStore';
import { useCreditStore } from '../store/creditStore';
import { colors } from '../theme/colors';
import DiamondLoader from '../components/DiamondLoader';
import { getGenreMeta } from '../theme/genre';
import { SoundService } from '../services/SoundService';
import { HapticService } from '../services/HapticService';
import Plumbob from '../components/Plumbob';
import api from '../services/api';

type Nav   = StackNavigationProp<StoryStackParamList, 'Ending'>;
type Route = RouteProp<StoryStackParamList, 'Ending'>;

const CONTINUATION_CREDITS = 30;
const CONTINUATION_SCENES  = 5;

// Ending type configs
const ENDING_CONFIGS = {
  happy: {
    bg: ['#1B8A2E', '#FFD700'],
    headline: 'Happy Ending ✨',
    color: '#FFD700',
    particle: '🎉',
  },
  tragic: {
    bg: ['#1a1a2e', '#2d3561'],
    headline: 'Tragic Ending 💔',
    color: '#3b82f6',
    particle: '💧',
  },
  twist: {
    bg: ['#1a0050', '#8B0000'],
    headline: 'Twist Ending 🌀',
    color: '#EC4899',
    particle: '⚡',
  },
  secret: {
    bg: ['#000000', '#001a00'],
    headline: '🌟 Secret Ending',
    color: '#1db954',
    particle: '✨',
  },
};

export default function EndingScreen() {
  const navigation   = useNavigation<Nav>();
  const route        = useRoute<Route>();
  const { storyId }  = route.params;
  const insets       = useSafeAreaInsets();

  const activeStory    = useStoryStore((s) => s.activeStory);
  const setActiveStory = useStoryStore((s) => s.setActiveStory);
  const clearStory     = useStoryStore((s) => s.clearStory);
  const balance        = useCreditStore((s) => s.balance);
  const deductCredits  = useCreditStore((s) => s.deductCredits);

  const [isFavourite, setIsFavourite] = useState(activeStory?.is_favourite ?? false);
  const [saving,     setSaving]       = useState(false);
  const [continuing, setContinuing]   = useState(false);

  // Rating
  const [rating, setRating]       = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const heroAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const particleAnims = useRef(Array.from({ length: 8 }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }))).current;

  const endingType = (activeStory as any)?.ending_type ?? 'happy';
  const endingConfig = ENDING_CONFIGS[endingType as keyof typeof ENDING_CONFIGS] ?? ENDING_CONFIGS.happy;
  const genre = activeStory?.genre;
  const genreMeta = getGenreMeta(genre);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
    SoundService.play('storyComplete', 0.8);
    HapticService.storyComplete();
    launchParticles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function launchParticles() {
    particleAnims.forEach((p, i) => {
      const angle = (i / particleAnims.length) * Math.PI * 2;
      const dist  = 80 + Math.random() * 60;
      setTimeout(() => {
        p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(1);
        Animated.parallel([
          Animated.timing(p.x,       { toValue: Math.cos(angle) * dist, duration: 1000, useNativeDriver: true }),
          Animated.timing(p.y,       { toValue: Math.sin(angle) * dist - 40, duration: 1000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1,   duration: 100, useNativeDriver: true }),
            Animated.delay(700),
            Animated.timing(p.opacity, { toValue: 0,   duration: 300, useNativeDriver: true }),
          ]),
        ]).start();
      }, i * 80);
    });
  }

  async function handleFavourite() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/stories/${storyId}/favourite`);
      setIsFavourite(data.story.is_favourite);
    } catch { Alert.alert('Error', 'Something went wrong.'); }
    finally { setSaving(false); }
  }

  async function handleContinue() {
    if (balance < CONTINUATION_CREDITS) {
      Alert.alert('Not enough credits', `Continuing costs ${CONTINUATION_CREDITS} credits.`);
      return;
    }
    Alert.alert('Continue the Story?', `Add ${CONTINUATION_SCENES} more scenes for ${CONTINUATION_CREDITS} credits.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Continue (${CONTINUATION_CREDITS} ◆)`, onPress: async () => {
        setContinuing(true);
        try {
          const { data } = await api.post(`/stories/${storyId}/continue`);
          deductCredits(CONTINUATION_CREDITS);
          if (data.story) setActiveStory(data.story);
          navigation.replace('LoadingScene', { storyId });
        } catch (err: any) {
          Alert.alert('Error', err?.response?.data?.error ?? 'Something went wrong.');
        } finally { setContinuing(false); }
      }},
    ]);
  }

  async function handleRatingSubmit() {
    try {
      await api.patch(`/stories/${storyId}`, { rating, rating_comment: ratingComment || null });
      setRatingSubmitted(true);
    } catch { /* non-critical */ }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `I just finished "${activeStory?.title ?? activeStory?.genre + ' Story'}" on StoryLoom AI 🎭\n\n${endingConfig.headline}\n\nCreate your own story at StoryLoom.ai`,
        title: activeStory?.title ?? 'My StoryLoom Story',
      });
    } catch { /* dismissed */ }
  }

  return (
    <View style={[styles.screen, { backgroundColor: endingConfig.bg[1] }]}>
      {/* Dynamic background */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: endingConfig.bg[0], opacity: 0.6 }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: heroAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Particles */}
          <View style={styles.particleContainer} pointerEvents="none">
            {particleAnims.map((p, i) => (
              <Animated.Text key={i} style={[styles.particle, {
                opacity: p.opacity,
                transform: [{ translateX: p.x }, { translateY: p.y }],
              }]}>
                {endingConfig.particle}
              </Animated.Text>
            ))}
          </View>

          <Plumbob size={80} animated color={endingConfig.color} />
          <Text style={[styles.endingHeadline, { color: endingConfig.color }]}>{endingConfig.headline}</Text>
          {activeStory?.title && (
            <Text style={styles.storyTitle}>"{activeStory.title}"</Text>
          )}
          <View style={[styles.divider, { backgroundColor: endingConfig.color }]} />
          <View style={[styles.genreBadge, { backgroundColor: genreMeta.primary + '30', borderColor: genreMeta.primary + '60' }]}>
            <Text style={{ color: genreMeta.primary, fontSize: 12, fontWeight: '700' }}>
              {genreMeta.icon} {genre}
            </Text>
          </View>
        </Animated.View>

        {/* Rating */}
        {!ratingSubmitted ? (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>How was your story?</Text>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(n => (
                <TouchableOpacity key={n} onPress={() => { setRating(n); HapticService.choiceTap(); }}>
                  <Text style={[styles.star, n <= rating && styles.starActive]}>⭐</Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <>
                <TextInput
                  style={styles.ratingInput}
                  placeholder="What did you love? (optional)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  multiline
                />
                <TouchableOpacity style={styles.ratingSubmitBtn} onPress={handleRatingSubmit}>
                  <Text style={styles.ratingSubmitText}>Submit ✓</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingThanks}>✨ Thanks for your rating!</Text>
          </View>
        )}

        {/* Share */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.shareBtnText}>Share Your Story 📤</Text>
        </TouchableOpacity>

        {/* Continue offer */}
        <View style={styles.continuationCard}>
          <Text style={styles.continuationTitle}>Want more?</Text>
          <Text style={styles.continuationSub}>Add {CONTINUATION_SCENES} more scenes and keep it going</Text>
          <TouchableOpacity
            style={[styles.continueBtn, { backgroundColor: endingConfig.color }]}
            onPress={handleContinue}
            disabled={continuing}
          >
            {continuing
              ? <DiamondLoader size={22} animated showSparkles={false} />
              : <Text style={styles.continueBtnText}>Continue Story — {CONTINUATION_CREDITS} ◆</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Favourite / New Story */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={handleFavourite}
            disabled={saving}
          >
            {saving
              ? <DiamondLoader size={22} animated showSparkles={false} />
              : <Text style={styles.actionBtnText}>{isFavourite ? '★ Saved to Favourites' : '☆ Save to Favourites'}</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={() => { clearStory(); navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'StorySetupWizard' }] }); }}
          >
            <Text style={styles.actionBtnTextOutline}>🎭 Start a New Story</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { clearStory(); navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] }); }}
          >
            <Text style={styles.homeLink}>Return Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 24, gap: 16 },

  hero: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  particleContainer: { position: 'absolute', width: 1, height: 1, alignSelf: 'center', top: 80 },
  particle: { position: 'absolute', fontSize: 20 },

  endingHeadline: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 0.3 },
  storyTitle: {
    fontSize: 17, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', paddingHorizontal: 20,
  },
  divider: { width: 60, height: 2, borderRadius: 1 },
  genreBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 6,
  },

  // Rating
  ratingCard: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    padding: 20, gap: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  ratingTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  starsRow:    { flexDirection: 'row', gap: 8 },
  star:        { fontSize: 28, opacity: 0.3 },
  starActive:  { opacity: 1 },
  ratingInput: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, padding: 12, color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', minHeight: 60,
  },
  ratingSubmitBtn: {
    backgroundColor: colors.plumbob, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  ratingSubmitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ratingThanks:     { fontSize: 16, color: '#fff', fontWeight: '700' },

  // Share
  shareBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Continue
  continuationCard: {
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20,
    padding: 20, gap: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  continuationTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  continuationSub:   { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  continueBtn: {
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28,
    marginTop: 8,
  },
  continueBtnText: { color: '#000', fontSize: 15, fontWeight: '900' },

  // Actions
  actions: { gap: 10, paddingBottom: 8 },
  actionBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  actionBtnOutline: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  actionBtnText:        { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnTextOutline: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  homeLink: { textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.5)', paddingVertical: 8 },
});
