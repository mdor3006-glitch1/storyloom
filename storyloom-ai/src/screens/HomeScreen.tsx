import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, useWindowDimensions, Animated,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Image } from 'expo-image';
import { StoryStackParamList } from '../navigation/MainStack';
import { useCredits } from '../hooks/useCredits';
import { useStoryStore, Story } from '../store/storyStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { getGenreMeta } from '../theme/genre';
import { SoundService } from '../services/SoundService';
import Plumbob from '../components/Plumbob';
import SimsSilhouettes from '../components/SimsSilhouettes';
import api from '../services/api';

type Nav = StackNavigationProp<StoryStackParamList, 'Tabs'>;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeLeftLabel(story: Story): string | null {
  // Would use story.expires_at if we had it; placeholder
  return null;
}

export default function HomeScreen() {
  const navigation  = useNavigation<Nav>();
  const { width }   = useWindowDimensions();
  const insets      = useSafeAreaInsets();
  const { balance, syncBalance } = useCredits();
  const user         = useAuthStore((s) => s.user);
  const setActiveStory = useStoryStore((s) => s.setActiveStory);

  const [stories, setStories]       = useState<Story[]>([]);
  const [favourites, setFavourites] = useState<Story[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [streak, setStreak]         = useState<number>(0);

  const fadeAnim        = useRef(new Animated.Value(0)).current;
  const btnPulse        = useRef(new Animated.Value(1)).current;
  const lastFocusFetch  = useRef<number>(0);
  const FOCUS_THROTTLE  = 30_000;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // Pulse the CTA button
    Animated.loop(
      Animated.sequence([
        Animated.timing(btnPulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(btnPulse, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
    // Start menu music
    SoundService.fadeInMenuMusic();
    return () => { SoundService.stopMenuMusic(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    try {
      const [storiesRes, streakRes] = await Promise.allSettled([
        api.get<{ stories: Story[] }>('/stories'),
        api.get('/users/streak').catch(() => ({ data: { streak: 0 } })),
      ]);
      if (storiesRes.status === 'fulfilled') {
        const all = storiesRes.value.data.stories;
        setStories(all.filter(s => s.status !== 'completed'));
        setFavourites(all.filter(s => s.is_favourite && s.status === 'completed'));
      }
      if (streakRes.status === 'fulfilled') {
        setStreak((streakRes.value as any).data?.streak ?? 0);
      }
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
    syncBalance();
    lastFocusFetch.current = Date.now();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFocusFetch.current < FOCUS_THROTTLE) return;
      lastFocusFetch.current = Date.now();
      fetchData();
      syncBalance();
    }, [fetchData, syncBalance])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), syncBalance()]);
    setRefreshing(false);
  }, [fetchData, syncBalance]);

  function handleStoryPress(story: Story) {
    setActiveStory(story);
    if (story.current_scene_number === 0) {
      navigation.navigate('LoadingScene', { storyId: story.id });
    } else {
      navigation.navigate('Scene', { storyId: story.id, sceneNumber: story.current_scene_number });
    }
  }

  function handleNewStory() {
    navigation.navigate('StorySetupWizard');
  }

  function handleAbandon(storyId: string) {
    Alert.alert('Abandon Story', 'This story will be deleted. No credits refunded.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Abandon', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/stories/${storyId}`);
          setStories(prev => prev.filter(s => s.id !== storyId));
        } catch { Alert.alert('Error', 'Something went wrong.'); }
      }},
    ]);
  }

  const CARD_W = width - 40;

  function renderStoryCard(story: Story) {
    const meta     = getGenreMeta(story.genre);
    const progress = story.total_scenes > 0 ? story.current_scene_number / story.total_scenes : 0;
    const hasImage = !!(story as any).last_image_url;
    const timeLeft = timeLeftLabel(story);
    return (
      <TouchableOpacity
        key={story.id}
        style={[styles.storyCard, { width: CARD_W }]}
        onPress={() => handleStoryPress(story)}
        onLongPress={() => handleAbandon(story.id)}
        activeOpacity={0.88}
      >
        {/* Thumbnail */}
        <View style={styles.cardThumb}>
          {hasImage ? (
            <Image
              source={{ uri: (story as any).last_image_url }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.cardThumbPlaceholder, { backgroundColor: meta.primary + '22' }]}>
              <Text style={styles.cardThumbIcon}>{meta.icon}</Text>
            </View>
          )}
          {/* Genre accent bar */}
          <View style={[styles.cardAccentBar, { backgroundColor: meta.primary }]} />
          {/* Time warning */}
          {timeLeft && (
            <View style={styles.timeWarning}>
              <Text style={styles.timeWarningText}>{timeLeft}</Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardGenreIcon]}>{meta.icon}</Text>
            <Text style={styles.cardGenreLabel}>{story.genre}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {story.title || `${story.genre} Story`}
          </Text>

          {/* Progress bar */}
          <View style={styles.cardProgressRow}>
            <View style={styles.cardProgressBg}>
              <View style={[styles.cardProgressFill, {
                width: `${Math.round(progress * 100)}%` as any,
                backgroundColor: meta.primary,
              }]} />
            </View>
            <Text style={styles.cardProgressLabel}>
              {story.current_scene_number}/{story.total_scenes}
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardDate}>{story.status === 'completed' ? '✓ Complete' : 'In progress'}</Text>
            <View style={[styles.continueBadge, { backgroundColor: meta.primary }]}>
              <Text style={styles.continueBadgeText}>Continue →</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const streakColor = streak >= 14 ? '#7C3AED' : streak >= 7 ? '#F59E0B' : '#F97316';

  return (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      <SimsSilhouettes color={colors.plumbob} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.plumbob} />
        }
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <Plumbob size={28} color={colors.plumbob} />
            <Text style={styles.logoText}>StoryLoom<Text style={{ color: colors.plumbob }}> AI</Text></Text>
          </View>
          <TouchableOpacity
            style={[styles.creditBadge, balance < 20 && styles.creditBadgeRed]}
            onPress={() => navigation.navigate('Tabs', { screen: 'Credits' } as any)}
            activeOpacity={0.82}
          >
            <Text style={[styles.creditDiamond, balance < 20 && { color: balance === 0 ? '#EF4444' : '#F97316' }]}>◆</Text>
            <Text style={[styles.creditValue, balance < 20 && { color: balance === 0 ? '#EF4444' : '#F97316' }]}>{balance}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero section ── */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.heroName}>
              {user?.display_name?.split(' ')[0] ?? 'Storyteller'} ✨
            </Text>
          </View>
          {streak > 0 && (
            <TouchableOpacity style={[styles.streakBadge, { backgroundColor: streakColor + '18', borderColor: streakColor }]}>
              <Text style={[styles.streakText, { color: streakColor }]}>🔥 {streak} day streak</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Active Stories ── */}
        {stories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>◆ ACTIVE STORIES</Text>
            <FlatList
              data={stories}
              keyExtractor={s => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => renderStoryCard(item)}
            />
          </View>
        )}

        {/* ── New Story CTA ── */}
        <View style={styles.ctaSection}>
          <Animated.View style={{ transform: [{ scale: btnPulse }] }}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={handleNewStory}
              activeOpacity={0.88}
            >
              <Plumbob size={22} color="#fff" />
              <Text style={styles.ctaBtnText}>
                {stories.length === 0 ? 'Create Your First Story ✨' : 'Start New Story ✨'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          {stories.length === 0 && (
            <Text style={styles.ctaSubtext}>Takes 30 seconds to set up</Text>
          )}
        </View>

        {/* ── Empty state (no stories) ── */}
        {stories.length === 0 && !loading && (
          <View style={styles.empty}>
            <Plumbob size={96} animated />
            <Text style={styles.emptyTitle}>Your story begins here</Text>
            <Text style={styles.emptySubtitle}>
              You have {balance} credits ready.{'\n'}Start your first adventure.
            </Text>
          </View>
        )}

        {/* ── Favourites ── */}
        {favourites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>⭐ FAVOURITES</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Tabs', { screen: 'Favourites' } as any)}>
                <Text style={styles.sectionSeeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={favourites.slice(0, 5)}
              keyExtractor={s => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => renderStoryCard(item)}
            />
          </View>
        )}

        {/* ── Streak motivation ── */}
        <View style={styles.streakMotivation}>
          <Text style={styles.streakMotivText}>
            {streak === 0
              ? '🎯 Start your streak today! Play a story to begin.'
              : `🔥 ${streak}-day streak! Keep it going — play today.`
            }
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.bg },
  scroll:       { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText:    { fontSize: 18, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.3 },

  creditBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.bgCard, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: colors.plumbobBorder,
    shadowColor: colors.plumbob, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  creditBadgeRed: { borderColor: '#EF444440' },
  creditDiamond:  { fontSize: 12, color: colors.plumbob },
  creditValue:    { fontSize: 15, fontWeight: '800', color: colors.plumbob },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
  },
  heroLeft:  {},
  greeting:  { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  heroName:  { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },

  streakBadge: {
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  streakText: { fontSize: 12, fontWeight: '700' },

  // Sections
  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionLabel:  { fontSize: 10, fontWeight: '800', color: colors.plumbob, letterSpacing: 2.5, paddingHorizontal: 20, marginBottom: 12 },
  sectionSeeAll: { fontSize: 12, color: colors.plumbob, fontWeight: '600' },

  // Story card
  storyCard: {
    backgroundColor: colors.bgCard, borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  cardThumb:            { height: 120, position: 'relative', backgroundColor: colors.bgSurface },
  cardThumbPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cardThumbIcon:        { fontSize: 36 },
  cardAccentBar:        { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  timeWarning: {
    position: 'absolute', bottom: 6, right: 8,
    backgroundColor: 'rgba(239,68,68,0.9)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  timeWarningText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  cardBody: { padding: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  cardGenreIcon: { fontSize: 11 },
  cardGenreLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 18, marginBottom: 8 },

  cardProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardProgressBg: {
    flex: 1, height: 3, backgroundColor: colors.bgSurface, borderRadius: 2, overflow: 'hidden',
  },
  cardProgressFill: { height: 3, borderRadius: 2 },
  cardProgressLabel: { fontSize: 9, color: colors.textMuted, minWidth: 28, textAlign: 'right' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDate:   { fontSize: 10, color: colors.textMuted },
  continueBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  continueBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // CTA
  ctaSection: { paddingHorizontal: 20, marginBottom: 16, alignItems: 'center' },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.plumbob,
    borderRadius: 20, paddingVertical: 17, paddingHorizontal: 32,
    shadowColor: colors.plumbob, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  ctaSubtext: { fontSize: 12, color: colors.textMuted, marginTop: 8, textAlign: 'center' },

  // Empty state
  empty: {
    alignItems: 'center', paddingHorizontal: 40, paddingTop: 8, paddingBottom: 24, gap: 14,
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' },
  emptySubtitle: {
    fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21,
  },

  // Streak
  streakMotivation: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  streakMotivText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
