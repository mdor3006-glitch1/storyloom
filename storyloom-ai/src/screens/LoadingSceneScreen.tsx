import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { StoryStackParamList } from '../navigation/MainStack';
import { useStoryStore } from '../store/storyStore';
import api from '../services/api';

type Nav   = StackNavigationProp<StoryStackParamList, 'LoadingScene'>;
type Route = RouteProp<StoryStackParamList, 'LoadingScene'>;

const HINTS = [
  'Building your world…',
  'Writing the scene…',
  'Giving your characters life…',
  'Painting the atmosphere…',
  'The story unfolds…',
];

export default function LoadingSceneScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { storyId, playerChoice, playerTextInput } = route.params;

  const setCurrentScene  = useStoryStore((s) => s.setCurrentScene);
  const setActiveStory   = useStoryStore((s) => s.setActiveStory);
  const setUndoAvailable = useStoryStore((s) => s.setUndoAvailable);

  const [hint, setHint] = useState(HINTS[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Animations ───────────────────────────────────────────────
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const dotAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Pulse on the orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Rotate the ring
    Animated.loop(
      Animated.timing(dotAnim, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Cycle hint text every 2.5 s
    let idx = 0;
    const hintTimer = setInterval(() => {
      idx = (idx + 1) % HINTS.length;
      setHint(HINTS[idx]);
    }, 2500);

    return () => clearInterval(hintTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Call backend ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function generateScene() {
      try {
        const body: Record<string, string> = {};
        if (playerChoice)    body.player_choice     = playerChoice;
        if (playerTextInput) body.player_text_input = playerTextInput;

        const { data } = await api.post(`/stories/${storyId}/scenes`, body);

        if (cancelled) return;

        setCurrentScene(data.scene);
        setUndoAvailable(!data.scene.is_undo_snapshot);

        // Refresh story state
        const storyRes = await api.get(`/stories/${storyId}`);
        if (!cancelled) setActiveStory(storyRes.data.story);

        if (data.is_final_scene) {
          navigation.replace('Ending', { storyId });
        } else {
          navigation.replace('Scene', { storyId, sceneNumber: data.scene.scene_number });
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.response?.data?.error ?? t('errors.generic');
        setErrorMsg(msg);
      }
    }

    generateScene();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = dotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (errorMsg) {
    return (
      <View style={styles.screen}>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.errorSub} onPress={() => navigation.goBack()}>← Go back</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      {/* Animated orb */}
      <View style={styles.orbContainer}>
        <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />
        <Animated.View style={[styles.orb, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      <Text style={styles.hint}>{hint}</Text>
      <Text style={styles.sub}>{t('scene.generating')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#2E4057',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  orbContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#048A81',
    shadowColor: '#048A81',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 12,
  },
  ring: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: 'rgba(4,138,129,0.35)',
    borderTopColor: '#048A81',
  },
  hint: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FAFAFA',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  sub: {
    fontSize: 13,
    color: 'rgba(250,250,250,0.5)',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FAFAFA',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  errorSub: {
    fontSize: 14,
    color: '#A8D5D1',
  },
});
