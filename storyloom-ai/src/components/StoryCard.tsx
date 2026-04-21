import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Story } from '../store/storyStore';
import { colors } from '../theme/colors';

interface Props {
  story: Story;
  onPress: () => void;
  onLongPress?: () => void;
}

const GENRE_COLORS: Record<string, string> = {
  Romance: '#9D4EDD', Thriller: '#EF4444', Fantasy: '#3B82F6',
  Horror: '#DC2626', Drama: '#F59E0B', 'Sci-Fi': '#06B6D4', default: '#8B5CF6',
};

export default function StoryCard({ story, onPress, onLongPress }: Props) {
  const progress = story.total_scenes > 0
    ? Math.round((story.current_scene_number / story.total_scenes) * 100)
    : 0;
  const accent = GENRE_COLORS[story.genre] ?? GENRE_COLORS.default;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[styles.genreDot, { backgroundColor: accent }]} />
        <Text style={styles.genreLabel}>{story.genre}</Text>
        {story.is_favourite && <Text style={styles.star}>★</Text>}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {story.title || `${story.genre} Story`}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>{story.setting} · {story.tone}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accent }]} />
      </View>
      <Text style={styles.progressLabel}>
        Scene {story.current_scene_number} of {story.total_scenes}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  genreDot: { width: 8, height: 8, borderRadius: 4 },
  genreLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  star: { fontSize: 13, color: colors.gold },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4, lineHeight: 21 },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  progressTrack: {
    height: 3,
    backgroundColor: colors.bgSurface,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: 11, color: colors.textMuted },
});
