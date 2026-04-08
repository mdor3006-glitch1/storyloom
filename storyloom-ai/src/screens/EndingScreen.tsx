import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { StoryStackParamList } from '../navigation/MainStack';
import { useStoryStore } from '../store/storyStore';
import api from '../services/api';

type Nav   = StackNavigationProp<StoryStackParamList, 'Ending'>;
type Route = RouteProp<StoryStackParamList, 'Ending'>;

interface CharacterMemory {
  name: string;
  key_events: string[];
  is_ai_generated: boolean;
}

export default function EndingScreen() {
  const { t } = useTranslation();
  const navigation   = useNavigation<Nav>();
  const route        = useRoute<Route>();
  const { storyId }  = route.params;

  const activeStory = useStoryStore((s) => s.activeStory);
  const clearStory  = useStoryStore((s) => s.clearStory);

  const [characters, setCharacters] = useState<CharacterMemory[]>([]);
  const [isFavourite, setIsFavourite] = useState(activeStory?.is_favourite ?? false);
  const [saving, setSaving]    = useState(false);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/characters/${storyId}`);
        setCharacters(data.characters.filter((c: CharacterMemory) => !c.is_ai_generated));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFavourite() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/stories/${storyId}/favourite`);
      setIsFavourite(data.story.is_favourite);
    } catch {
      Alert.alert('Error', t('errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  function handleNewStory() {
    clearStory();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }, { name: 'StorySetupWizard' }] });
  }

  function handleHome() {
    clearStory();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }

  const allKeyEvents = characters.flatMap((c) =>
    (c.key_events ?? []).map((e) => ({ character: c.name, event: e }))
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🎬</Text>
        <Text style={styles.heroTitle}>{t('ending.title')}</Text>
        {activeStory && (
          <Text style={styles.heroGenre}>
            {activeStory.genre} · {activeStory.setting}
          </Text>
        )}
      </View>

      {/* Key moments */}
      {loading ? (
        <ActivityIndicator color="#048A81" style={{ marginVertical: 24 }} />
      ) : allKeyEvents.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Moments</Text>
          {allKeyEvents.map((item, i) => (
            <View key={i} style={styles.eventRow}>
              <View style={styles.eventDot} />
              <View style={styles.eventBody}>
                <Text style={styles.eventChar}>{item.character}</Text>
                <Text style={styles.eventText}>{item.event}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleFavourite}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>
                {isFavourite ? '★ Saved to Favourites' : t('ending.save_favourite')}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleNewStory} activeOpacity={0.85}>
          <Text style={styles.btnSecondaryText}>{t('ending.new_story')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnText} onPress={handleHome} activeOpacity={0.7}>
          <Text style={styles.btnTextLabel}>{t('ending.home')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroEmoji: { fontSize: 64, marginBottom: 12 },
  heroTitle: { fontSize: 36, fontWeight: '800', color: '#2E4057', marginBottom: 6 },
  heroGenre: { fontSize: 15, color: '#6B7C93' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7C93', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  eventRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-start' },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#048A81', marginTop: 6, marginRight: 12 },
  eventBody: { flex: 1 },
  eventChar: { fontSize: 12, fontWeight: '700', color: '#048A81', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  eventText: { fontSize: 15, color: '#2E4057', lineHeight: 22 },
  actions: { gap: 12 },
  btn: { borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#048A81' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: { backgroundColor: '#F0F4F8' },
  btnSecondaryText: { color: '#2E4057', fontSize: 16, fontWeight: '600' },
  btnText: { alignItems: 'center', paddingVertical: 10 },
  btnTextLabel: { fontSize: 15, color: '#6B7C93' },
});
