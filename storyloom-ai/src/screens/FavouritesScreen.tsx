import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Story } from '../store/storyStore';
import api from '../services/api';

export default function FavouritesScreen() {
  const { t } = useTranslation();
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
    Alert.alert('Remove from Favourites', 'This story will be auto-deleted after 10 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await api.patch(`/stories/${storyId}/favourite`);
            setStories((prev) => prev.filter((s) => s.id !== storyId));
          } catch {
            Alert.alert('Error', t('errors.generic'));
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Favourites</Text>
      </View>

      <FlatList
        data={stories}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#048A81" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>★</Text>
            <Text style={styles.emptyTitle}>No favourites yet</Text>
            <Text style={styles.emptySubtitle}>Save a completed story to keep it forever.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onLongPress={() => handleUnfavourite(item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.genre}</Text>
              <Text style={styles.starIcon}>★</Text>
            </View>
            <Text style={styles.cardMeta}>{item.genre} · {item.setting} · {item.tone}</Text>
            <Text style={styles.cardScenes}>{item.total_scenes} scenes · {item.art_style}</Text>
            <Text style={styles.cardDate}>
              Completed {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '—'}
            </Text>
            <Text style={styles.cardHint}>Long press to remove</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  title: { fontSize: 22, fontWeight: '800', color: '#2E4057' },
  list: { padding: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, color: '#DCE4EB', marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2E4057', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#6B7C93', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#2E4057',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#2E4057', flex: 1 },
  starIcon: { fontSize: 16, color: '#048A81', marginLeft: 8 },
  cardMeta: { fontSize: 13, color: '#6B7C93', marginBottom: 4 },
  cardScenes: { fontSize: 13, color: '#6B7C93', marginBottom: 8 },
  cardDate: { fontSize: 12, color: '#A0AEBA', marginBottom: 4 },
  cardHint: { fontSize: 11, color: '#C8D8DC' },
});
