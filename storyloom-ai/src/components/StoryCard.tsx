import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Story } from '../store/storyStore';

interface Props {
  story: Story;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function StoryCard({ story, onPress, onLongPress }: Props) {
  const progress = Math.round((story.current_scene_number / story.total_scenes) * 100);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {story.title || story.genre}
        </Text>
        {story.is_favourite && <Text style={styles.star}>★</Text>}
      </View>
      <Text style={styles.meta}>
        {story.genre} · {story.setting} · {story.tone}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        Scene {story.current_scene_number} of {story.total_scenes}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: '#2E4057', flex: 1 },
  star: { fontSize: 16, color: '#048A81', marginLeft: 8 },
  meta: { fontSize: 13, color: '#6B7C93', marginBottom: 10 },
  progressTrack: {
    height: 4,
    backgroundColor: '#DDEAEF',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#048A81', borderRadius: 2 },
  progressLabel: { fontSize: 12, color: '#6B7C93' },
});
