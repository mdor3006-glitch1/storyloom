import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { StoryStackParamList } from '../navigation/MainStack';
import { useCredits } from '../hooks/useCredits';
import { useStoryStore, Story } from '../store/storyStore';
import CreditBalanceBadge from '../components/CreditBalanceBadge';
import StoryCard from '../components/StoryCard';
import api from '../services/api';

type Nav = StackNavigationProp<StoryStackParamList, 'Tabs'>;

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { balance, syncBalance } = useCredits();
  const setActiveStory = useStoryStore((s) => s.setActiveStory);

  const [stories, setStories] = useState<Story[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    try {
      const { data } = await api.get<{ stories: Story[] }>('/stories');
      setStories(data.stories);
    } catch {
      // silently keep stale list
    }
  }, []);

  useEffect(() => {
    fetchStories().finally(() => setLoading(false));
    syncBalance();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStories(), syncBalance()]);
    setRefreshing(false);
  }, [fetchStories, syncBalance]);

  function handleStoryPress(story: Story) {
    setActiveStory(story);
    if (story.current_scene_number === 0) {
      navigation.navigate('LoadingScene', { storyId: story.id });
    } else {
      navigation.navigate('Scene', { storyId: story.id, sceneNumber: story.current_scene_number });
    }
  }

  function handleAbandon(storyId: string) {
    Alert.alert('Abandon Story', 'Are you sure? No credits will be refunded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Abandon', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/stories/${storyId}`);
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
        <Text style={styles.appName}>StoryLoom</Text>
        <CreditBalanceBadge balance={balance} />
      </View>

      <FlatList
        data={stories}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#048A81" />
        }
        ListHeaderComponent={
          stories.length > 0 ? (
            <Text style={styles.sectionLabel}>{t('home.active_stories')}</Text>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={styles.emptyTitle}>No stories yet</Text>
              <Text style={styles.emptySubtitle}>{t('home.no_stories')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <StoryCard
            story={item}
            onPress={() => handleStoryPress(item)}
            onLongPress={() => handleAbandon(item.id)}
          />
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('StorySetupWizard')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ {t('home.new_story')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  appName: { fontSize: 22, fontWeight: '800', color: '#2E4057', letterSpacing: -0.5 },
  list: { padding: 20, paddingBottom: 110 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6B7C93', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2E4057', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#6B7C93', textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: '#048A81',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#048A81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
