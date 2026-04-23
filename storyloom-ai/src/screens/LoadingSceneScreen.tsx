import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { StoryStackParamList } from '../navigation/MainStack';
import { useStoryStore } from '../store/storyStore';
import { getGenreMeta } from '../theme/genre';
import { colors } from '../theme/colors';
import Plumbob from '../components/Plumbob';
import DiamondLoader from '../components/DiamondLoader';
import { getGenreColor } from '../components/DiamondLoader';
import api from '../services/api';

type Nav   = StackNavigationProp<StoryStackParamList, 'LoadingScene'>;
type Route = RouteProp<StoryStackParamList, 'LoadingScene'>;

const MEANWHILE = [
  'Meanwhile…',
  'The story continues…',
  'What happens next?',
  'The plot thickens…',
  'Fate decides…',
  'In another moment…',
];

const MIN_LOADING_MS = 1500;

export default function LoadingSceneScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { storyId, playerChoice, playerTextInput, reason } = route.params;

  const setCurrentScene  = useStoryStore((s) => s.setCurrentScene);
  const setActiveStory   = useStoryStore((s) => s.setActiveStory);
  const setUndoAvailable = useStoryStore((s) => s.setUndoAvailable);
  const activeStory      = useStoryStore((s) => s.activeStory);

  const [hint, setHint]       = useState(MEANWHILE[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const plumbobRot  = useRef(new Animated.Value(0)).current;
  const plumbobScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const hintOpacity  = useRef(new Animated.Value(1)).current;
  const dotAnims     = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  const genre = activeStory?.genre ?? 'Drama';
  const meta  = getGenreMeta(genre);
  const title = activeStory?.title ?? '';

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Plumbob rotation
    Animated.loop(
      Animated.timing(plumbobRot, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Plumbob pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(plumbobScale, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(plumbobScale, { toValue: 1.0,  duration: 500, useNativeDriver: true }),
      ])
    ).start();

    // Progress bar over 1.5s
    Animated.timing(progressAnim, { toValue: 1, duration: MIN_LOADING_MS, useNativeDriver: false }).start();

    // Hint cycling
    let idx = 0;
    const hintTimer = setInterval(() => {
      Animated.timing(hintOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        idx = (idx + 1) % MEANWHILE.length;
        setHint(MEANWHILE[idx]);
        Animated.timing(hintOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 2000);

    // Pulsing dots
    dotAnims.forEach((a, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(a, { toValue: 1,   duration: 400, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    });

    return () => clearInterval(hintTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    const startTime = Date.now();
    const isFirstScene = reason === 'first_scene' || (!playerChoice && !playerTextInput);

    async function tryWarmBundle(): Promise<boolean> {
      if (!isFirstScene) return false;
      // Poll up to 8 times over ~12 seconds — warm pregen typically takes 8–12 s
      // (Claude 3–6 s + FLUX 5–10 s). Better to wait than fire a redundant live gen.
      for (let i = 0; i < 8; i++) {
        if (cancelled) return false;
        try {
          const { data } = await api.get(`/stories/${storyId}/warm-scene-1`);
          if (data?.ready && data?.bundle) {
            const resp = await api.post(`/stories/${storyId}/scenes`, {});
            if (cancelled) return false;
            finish(resp.data);
            return true;
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 1500));
      }
      return false;
    }

    function finish(data: any) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        setCurrentScene(data.scene);
        setUndoAvailable(data.scene.scene_number > 1 && !data.scene.is_undo_snapshot);
        api.get(`/stories/${storyId}`).then(({ data: sd }) => {
          if (!cancelled && sd?.story) setActiveStory(sd.story);
        }).catch(() => {});
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          if (data.is_final_scene) {
            navigation.replace('Ending', { storyId });
          } else {
            navigation.replace('Scene', { storyId, sceneNumber: data.scene.scene_number });
          }
        });
      }, remaining);
    }

    async function generate() {
      try {
        const warmed = await tryWarmBundle();
        if (warmed || cancelled) return;

        const body: Record<string, string> = {};
        if (playerChoice)    body.player_choice      = playerChoice;
        if (playerTextInput) body.player_text_input  = playerTextInput;

        const { data } = await api.post(`/stories/${storyId}/scenes`, body);
        if (cancelled) return;
        finish(data);
      } catch (err: any) {
        if (cancelled) return;
        if (retryCount < 2) {
          // Single retry trigger: bump retryCount. The effect re-runs (after
          // the cleanup below aborts this pass), and schedules the retry with
          // a 1 s delay — no parallel setTimeout fire.
          setRetryCount(r => r + 1);
        } else {
          setErrorMsg(err?.response?.data?.error ?? 'Something went wrong. Your credits were not spent.');
        }
      }
    }

    // First run: immediate. Subsequent runs (retries): 1 s delay before firing.
    if (retryCount === 0) {
      generate();
    } else {
      delayTimer = setTimeout(generate, 1000);
    }

    return () => {
      cancelled = true;
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = plumbobRot.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] });

  if (errorMsg) {
    return (
      <View style={[styles.screen, { backgroundColor: '#0a0a1a' }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.errorAction} onPress={() => navigation.goBack()}>← Go back</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      {/* Animated gradient background — simulated with a deep colored bg */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: meta.gradient[1] }]} />
      <Animated.View
        style={[StyleSheet.absoluteFillObject, {
          backgroundColor: meta.gradient[0],
          opacity: plumbobScale.interpolate({ inputRange: [1, 1.15], outputRange: [0.5, 0.8] }),
        }]}
      />

      {/* Center content */}
      <View style={styles.center}>
        {/* Rotating + pulsing plumbob */}
        <Animated.View style={[styles.plumbobWrap, {
          transform: [{ rotate: spin }, { scale: plumbobScale }],
        }]}>
          <DiamondLoader size={80} color={getGenreColor(genre)} animated showSparkles />
        </Animated.View>

        {/* Story title */}
        {title ? (
          <Text style={styles.title}>{title}</Text>
        ) : null}

        {/* Hint text */}
        <Animated.Text style={[styles.hint, { opacity: hintOpacity }]}>{hint}</Animated.Text>

        {/* Pulsing dots */}
        <View style={styles.dotsRow}>
          {dotAnims.map((a, i) => (
            <Animated.View key={i} style={[styles.dot, { backgroundColor: meta.primary, opacity: a }]} />
          ))}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, {
            backgroundColor: meta.primary,
            width: progressAnim.interpolate({ inputRange: [0,1], outputRange: ['0%', '100%'] }),
          }]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0a0a1a',
  },
  center: { alignItems: 'center', gap: 20, paddingHorizontal: 40 },
  plumbobWrap: { marginBottom: 8 },
  title: {
    fontSize: 20, fontWeight: '800', color: '#FFFFFF',
    textAlign: 'center', letterSpacing: 2,
  },
  hint: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', letterSpacing: 0.5,
  },
  dotsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  progressTrack: {
    position: 'absolute', bottom: 48, left: 40, right: 40,
    height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2 },

  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: {
    fontSize: 15, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', paddingHorizontal: 40, marginBottom: 24, lineHeight: 22,
  },
  errorAction: { fontSize: 15, color: colors.plumbob, fontWeight: '700' },
});
