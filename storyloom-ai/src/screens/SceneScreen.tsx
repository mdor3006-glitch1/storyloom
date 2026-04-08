import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { StoryStackParamList } from '../navigation/MainStack';
import { useStoryStore, Scene } from '../store/storyStore';
import SceneImage from '../components/SceneImage';
import ProgressBar from '../components/ProgressBar';
import ChoiceButton from '../components/ChoiceButton';
import TextInputWithSuggestions from '../components/TextInputWithSuggestions';
import api from '../services/api';

type Nav   = StackNavigationProp<StoryStackParamList, 'Scene'>;
type Route = RouteProp<StoryStackParamList, 'Scene'>;

// How often to poll for the scene image when it's not yet available (ms)
const IMAGE_POLL_INTERVAL = 3000;
const IMAGE_POLL_MAX      = 10; // give up after 30 s

export default function SceneScreen() {
  const { t } = useTranslation();
  const navigation    = useNavigation<Nav>();
  const route         = useRoute<Route>();
  const { storyId, sceneNumber } = route.params;

  const activeStory     = useStoryStore((s) => s.activeStory);
  const currentScene    = useStoryStore((s) => s.currentScene);
  const undoAvailable   = useStoryStore((s) => s.undoAvailable);
  const setCurrentScene = useStoryStore((s) => s.setCurrentScene);
  const setActiveStory  = useStoryStore((s) => s.setActiveStory);

  const [scene, setScene]       = useState<Scene | null>(currentScene ?? null);
  const [textInput, setTextInput] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [undoing, setUndoing]   = useState(false);
  const [reporting, setReporting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCount = useRef(0);

  // Fade-in animation when scene loads
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Load scene from store or fetch from API ──────────────────
  useEffect(() => {
    if (currentScene && currentScene.scene_number === sceneNumber) {
      setScene(currentScene);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      fetchScene();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchScene() {
    try {
      const { data } = await api.get(`/stories/${storyId}`);
      const storyData = data.story;
      setActiveStory(storyData);
      // The scene we want is the current one
      const { data: scenesData } = await api.get(`/stories/${storyId}/scenes/${sceneNumber}`).catch(() =>
        // Fallback: re-fetch story which has current scene embedded
        ({ data: { scene: null } })
      );
      const s: Scene = scenesData?.scene ?? storyData.current_scene;
      if (s) {
        setScene(s);
        setCurrentScene(s);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }
    } catch {
      // Silently keep whatever we have in state
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }

  // ── Poll for image when it's still generating ────────────────
  useEffect(() => {
    if (!scene || scene.image_url || pollCount.current >= IMAGE_POLL_MAX) return;

    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current >= IMAGE_POLL_MAX) {
        clearInterval(pollRef.current!);
        return;
      }
      try {
        const { data } = await api.get(`/stories/${storyId}/scenes-current`);
        if (data?.scene?.image_url) {
          setScene((prev) => prev ? { ...prev, image_url: data.scene.image_url } : prev);
          clearInterval(pollRef.current!);
        }
      } catch { /* ignore */ }
    }, IMAGE_POLL_INTERVAL);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [scene?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Choice handler (Task 4.4) ─────────────────────────────────
  const handleChoice = useCallback((choice: string, freeText?: string) => {
    if (choosing) return;
    setChoosing(true);
    navigation.navigate('LoadingScene', {
      storyId,
      playerChoice: choice,
      playerTextInput: freeText || undefined,
    });
  }, [choosing, navigation, storyId]);

  // ── Undo ──────────────────────────────────────────────────────
  async function handleUndo() {
    if (undoing || !undoAvailable) return;
    Alert.alert('Undo Last Scene', 'Go back to the previous scene? You only get one undo per story.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo', onPress: async () => {
          setUndoing(true);
          try {
            const { data } = await api.post(`/stories/${storyId}/undo`);
            setCurrentScene(data.scene);
            setScene(data.scene);
            navigation.replace('Scene', { storyId, sceneNumber: data.scene.scene_number });
          } catch (err: any) {
            Alert.alert('Cannot undo', err?.response?.data?.error ?? t('errors.generic'));
          } finally {
            setUndoing(false);
          }
        },
      },
    ]);
  }

  // ── Report (Task 4.10) ────────────────────────────────────────
  async function handleReport() {
    if (reporting || !scene) return;
    Alert.alert('Report Content', 'Flag this scene as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report', style: 'destructive', onPress: async () => {
          setReporting(true);
          try {
            await api.post('/reports', { story_id: storyId, scene_id: scene.id });
            Alert.alert('Reported', 'Thank you. Our team will review this scene.');
          } catch {
            Alert.alert('Error', t('errors.generic'));
          } finally {
            setReporting(false);
          }
        },
      },
    ]);
  }

  const setUndoAvailable = useStoryStore((s) => s.setUndoAvailable);

  if (!scene) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#048A81" />
      </View>
    );
  }

  const total   = activeStory?.total_scenes ?? 1;
  const choices = scene.choices ?? [];

  return (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Scene image */}
        <SceneImage uri={scene.image_url ?? null} />

        {/* Progress bar */}
        <ProgressBar current={scene.scene_number} total={total} />

        {/* Story text */}
        <View style={styles.textBlock}>
          <Text style={styles.storyText}>{scene.scene_text}</Text>

          {/* Dialogue overlay */}
          {(scene.dialogue ?? []).length > 0 && (
            <View style={styles.dialogueBlock}>
              {(scene.dialogue ?? []).map((line: { character: string; line: string }, i: number) => (
                <View key={i} style={styles.dialogueLine}>
                  <Text style={styles.dialogueChar}>{line.character}</Text>
                  <Text style={styles.dialogueText}>"{line.line}"</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Choice buttons */}
        <View style={styles.choices}>
          {choices.map((choice: string, i: number) => (
            <ChoiceButton
              key={i}
              label={choice}
              onPress={() => handleChoice(choice)}
              disabled={choosing}
            />
          ))}
        </View>

        {/* Free text input */}
        <View style={styles.inputWrap}>
          <TextInputWithSuggestions
            value={textInput}
            onChange={setTextInput}
            onSubmit={(val) => handleChoice('', val)}
            disabled={choosing}
          />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolBtn, !undoAvailable && styles.toolBtnDisabled]}
          onPress={handleUndo}
          disabled={!undoAvailable || undoing}
        >
          {undoing
            ? <ActivityIndicator size="small" color="#2E4057" />
            : <Text style={styles.toolBtnText}>{t('scene.undo')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={handleReport} disabled={reporting}>
          {reporting
            ? <ActivityIndicator size="small" color="#2E4057" />
            : <Text style={styles.toolBtnText}>{t('scene.report')}</Text>}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  textBlock: { padding: 20 },
  storyText: {
    fontSize: 17,
    lineHeight: 28,
    color: '#2E4057',
    fontFamily: 'Georgia',
  },
  dialogueBlock: { marginTop: 16, gap: 10 },
  dialogueLine: { paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: '#048A81' },
  dialogueChar: { fontSize: 12, fontWeight: '700', color: '#048A81', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  dialogueText: { fontSize: 15, color: '#2E4057', fontStyle: 'italic', lineHeight: 22 },

  choices: { paddingHorizontal: 20, paddingTop: 8, gap: 0 },
  inputWrap: { paddingTop: 12 },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
    backgroundColor: '#FAFAFA',
  },
  toolBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F4F8',
  },
  toolBtnDisabled: { opacity: 0.4 },
  toolBtnText: { fontSize: 14, color: '#2E4057', fontWeight: '600' },
});
