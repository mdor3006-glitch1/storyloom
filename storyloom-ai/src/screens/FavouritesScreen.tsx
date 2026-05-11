import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { Story } from '../store/storyStore';
import { useStoryStore } from '../store/storyStore';
import { StoryStackParamList } from '../navigation/MainStack';
import api from '../services/api';
import { colors } from '../theme/colors';
import Plumbob from '../components/Plumbob';

type Nav = StackNavigationProp<StoryStackParamList, 'Tabs'>;

const GENRE_META: Record<string, { color: string; icon: string }> = {
  Romance:              { color: '#FF69B4', icon: '💕' },
  Thriller:             { color: '#EF4444', icon: '🔪' },
  Fantasy:              { color: '#7C4DFF', icon: '🧙' },
  Horror:               { color: '#9C27B0', icon: '👻' },
  Drama:                { color: '#42A5F5', icon: '🎬' },
  'Sci-Fi':             { color: '#00E5FF', icon: '🚀' },
  Comedy:               { color: '#69F0AE', icon: '😂' },
  'Cartoon Characters': { color: '#FFEB3B', icon: '🍌' },
  default:              { color: colors.plumbob, icon: '📖' },
};

export default function FavouritesScreen() {
  const { t } = useTranslation();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const setActiveStory = useStoryStore((s) => s.setActiveStory);
  const [stories, setStories] = useState<Story[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavourites = useCallback(async () => {
    try {
      const { data } = await api.get<{ stories: Story[] }>('/stories');
      setStories(data.stories.filter((s) => s.is_favourite));
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => { fetchFavourites(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavourites();
    setRefreshing(false);
  }, [fetchFavourites]);

  async function handleUnfavourite(storyId: string) {
    Alert.alert('Remove from Favourites', 'This story will auto-delete after 10 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await api.patch(`/stories/${storyId}/favourite`);
            setStories((prev) => prev.filter((s) => s.id !== storyId));
          } catch { Alert.alert('Error', t('errors.generic')); }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <Plumbob size={26} color={colors.plumbob} />
          <Text style={styles.headerTitle}>Favourites</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{stories.length}</Text>
        </View>
      </View>

      <FlatList
        data={stories}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.plumbob} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Plumbob size={80} animated color={colors.plumbob} />
            <Text style={styles.emptyTitle}>No favourites yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete a story and save it to keep it forever
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = GENRE_META[item.genre] ?? GENRE_META.default;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                setActiveStory(item);
                if (item.current_scene_number === 0) {
                  navigation.navigate('LoadingScene', { storyId: item.id });
                } else {
                  navigation.navigate('Scene', { storyId: item.id, sceneNumber: item.current_scene_number });
                }
              }}
              onLongPress={() => handleUnfavourite(item.id)}
              activeOpacity={0.84}
            >
              {/* Left accent bar */}
              <View style={[styles.accentBar, { backgroundColor: meta.color }]} />

              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardGenreIcon}>{meta.icon}</Text>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title || `${item.genre} Story`}
                  </Text>
                  <Text style={[styles.starIcon, { color: meta.color }]}>★</Text>
                </View>
                <Text style={styles.cardMeta}>{item.genre} · {item.setting} · {item.tone}</Text>
                <Text style={styles.cardScenes}>{item.total_scenes} scenes · {item.art_style}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardDate}>
                    {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'In progress'}
                  </Text>
                  <Text style={styles.cardHint}>Hold to remove</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },
  countBadge: {
    backgroundColor: colors.plumbob,
    borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    minWidth: 28, alignItems: 'center',
  },
  countText: { fontSize: 13, fontWeight: '800', color: colors.bg },

  list: { paddingHorizontal: 18, paddingBottom: 40 },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    marginBottom: 6,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  accentBar: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  cardGenreIcon: { fontSize: 16 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  starIcon: { fontSize: 14 },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  cardScenes: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 10, color: colors.textMuted },
  cardHint: { fontSize: 9, color: colors.textMuted, fontStyle: 'italic' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
});
