import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, AppState, AppStateStatus, useWindowDimensions, Easing, Pressable,
  TextInput, Keyboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoryStackParamList } from '../navigation/MainStack';
import { useStoryStore, Scene } from '../store/storyStore';
import { useCreditStore } from '../store/creditStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { colors } from '../theme/colors';
import { getGenreMeta } from '../theme/genre';
import GlassView from '../components/GlassView';
import Plumbob from '../components/Plumbob';
import { SoundService } from '../services/SoundService';
import { HapticService } from '../services/HapticService';
import api from '../services/api';

type Nav   = StackNavigationProp<StoryStackParamList, 'Scene'>;
type Route = RouteProp<StoryStackParamList, 'Scene'>;

// ── Tunables ──────────────────────────────────────────────────
const IMAGE_POLL_INTERVAL = 3000;
const IMAGE_POLL_MAX      = 20;
const TYPEWRITER_MS       = 35;
const BUBBLE_PAUSE_MS     = 400;
const CHOICE_REVEAL_AT    = 3;
const MAX_BUBBLE_WIDTH    = 0.75;
const MIN_FILLER_MS       = 8_000;
const MAX_FILLER_MS       = 18_000;
const MIN_SCENE_DISPLAY_MS = 2_500;
const PREFETCH_BACKOFF_MS = [0, 200, 600, 1400];
const STORAGE_KEY         = 'storyloom_scene_state_v2';
const STAGE_RESUME_TTL_MS = 30 * 60 * 1000;

// ── State machine ─────────────────────────────────────────────
type Phase = 'reading' | 'choosing' | 'stall_filler' | 'crossfade' | 'loading_overflow';

interface StageState {
  phase: Phase;
  visibleBubbles: number;
  typedTexts: string[];
  isTyping: boolean;
  showCursor: boolean;
  choicesRevealed: boolean;
  dialoguePaused: boolean;
  fillerStart: number | null;
  nextSceneReady: boolean;
  choiceIndex: number | null;
}

type StageAction =
  | { type: 'init'; dialogueLength: number }
  | { type: 'show_bubble'; index: number }
  | { type: 'type_progress'; index: number; text: string; cursor: boolean }
  | { type: 'type_done'; index: number }
  | { type: 'reveal_choices' }
  | { type: 'pause_dialogue' }
  | { type: 'resume_dialogue' }
  | { type: 'begin_choosing'; choiceIndex: number | null }
  | { type: 'begin_filler'; fillerLength: number }
  | { type: 'next_scene_ready' }
  | { type: 'begin_crossfade' }
  | { type: 'reset_for_new_scene'; dialogueLength: number }
  | { type: 'show_overflow' }
  | { type: 'restore_choices' };

function stageReducer(s: StageState, a: StageAction): StageState {
  switch (a.type) {
    case 'init':
    case 'reset_for_new_scene':
      return {
        phase: 'reading',
        visibleBubbles: 0,
        typedTexts: new Array(a.dialogueLength).fill(''),
        isTyping: false,
        showCursor: true,
        choicesRevealed: false,
        dialoguePaused: false,
        fillerStart: null,
        nextSceneReady: false,
        choiceIndex: null,
      };
    case 'show_bubble':
      return { ...s, visibleBubbles: a.index + 1, isTyping: true, showCursor: true };
    case 'type_progress': {
      const next = s.typedTexts.slice();
      next[a.index] = a.text;
      return { ...s, typedTexts: next, showCursor: a.cursor };
    }
    case 'type_done':
      return { ...s, isTyping: false, showCursor: false };
    case 'reveal_choices':
      return { ...s, choicesRevealed: true, dialoguePaused: true };
    case 'pause_dialogue':
      return { ...s, dialoguePaused: true };
    case 'resume_dialogue':
      return { ...s, dialoguePaused: false };
    case 'begin_choosing':
      return { ...s, phase: 'choosing', choiceIndex: a.choiceIndex, dialoguePaused: false };
    case 'begin_filler':
      return {
        ...s,
        phase: 'stall_filler',
        visibleBubbles: 0,
        typedTexts: new Array(a.fillerLength).fill(''),
        isTyping: false,
        showCursor: true,
        choicesRevealed: false,
        fillerStart: Date.now(),
      };
    case 'next_scene_ready':
      return { ...s, nextSceneReady: true };
    case 'begin_crossfade':
      return { ...s, phase: 'crossfade' };
    case 'show_overflow':
      return { ...s, phase: 'loading_overflow' };
    case 'restore_choices':
      return {
        ...s,
        phase: 'reading',
        choicesRevealed: true,
        dialoguePaused: true,
        fillerStart: null,
        nextSceneReady: false,
        choiceIndex: null,
      };
    default:
      return s;
  }
}

// ── Mood engine ───────────────────────────────────────────────
function deriveMood(tension: number | undefined, genre: string | undefined) {
  const t = tension ?? 0;
  if (t >= 81) return { label: 'Critical', icon: '💀', color: '#EF4444' };
  if (t >= 61) return { label: 'Intense',  icon: '🔥', color: '#F97316' };
  if (t >= 41) return { label: 'Tense',    icon: '⚡', color: '#EAB308' };
  if (t >= 21) {
    if (genre === 'Romance') return { label: 'Romantic', icon: '🌹', color: '#EC4899' };
    return { label: 'Flowing', icon: '🌊', color: '#3b82f6' };
  }
  const genreMap: Record<string, { label: string; icon: string; color: string }> = {
    Romance: { label: 'Calm', icon: '🌸', color: '#EC4899' },
    Horror:  { label: 'Calm', icon: '🌫️', color: '#8B5CF6' },
    Comedy:  { label: 'Calm', icon: '😊', color: '#22C55E' },
    'Sci-Fi':{ label: 'Calm', icon: '🌌', color: '#00E5FF' },
  };
  return genreMap[genre ?? ''] ?? { label: 'Calm', icon: '🌸', color: '#22C55E' };
}

// ── Weather overlay tint ──────────────────────────────────────
const WEATHER_TINT: Record<string, string> = {
  morning:   'rgba(255,200,100,0.15)',
  afternoon: 'rgba(255,255,255,0)',
  evening:   'rgba(255,120,50,0.20)',
  night:     'rgba(20,20,60,0.35)',
  clear:     'rgba(255,255,255,0)',
  cloudy:    'rgba(150,150,180,0.12)',
  rain:      'rgba(80,120,160,0.20)',
  storm:     'rgba(40,40,80,0.35)',
  snow:      'rgba(200,220,255,0.15)',
  fog:       'rgba(200,200,200,0.25)',
};
function weatherTint(tod?: string, weather?: string): string {
  const todColor = tod ? WEATHER_TINT[tod] : null;
  const wColor   = weather ? WEATHER_TINT[weather] : null;
  return wColor ?? todColor ?? 'rgba(0,0,0,0)';
}

// ── Cancellable sleep ─────────────────────────────────────────
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => { clearTimeout(t); resolve(); };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

// ── Chat bubble ───────────────────────────────────────────────
interface BubbleProps {
  line: { character: string; line: string; emotion?: string };
  isMain: boolean;
  showPortrait: boolean;
  text: string;
  showCursor: boolean;
  slideAnim: Animated.Value;
  screenWidth: number;
}

function ChatBubble({ line, isMain, showPortrait, text, showCursor, slideAnim, screenWidth }: BubbleProps) {
  const MAX_W = screenWidth * MAX_BUBBLE_WIDTH;
  const nameColor  = isMain ? colors.charMain : colors.charSecond;
  const bubbleTint = isMain ? 'rgba(127,119,221,0.22)' : 'rgba(123,47,190,0.22)';

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isMain ? -60 : 60, 0],
  });

  const initial = (line.character || '?').charAt(0).toUpperCase();

  return (
    <Animated.View
      style={[
        styles.bubbleRow,
        isMain ? styles.bubbleRowLeft : styles.bubbleRowRight,
        { opacity: slideAnim, transform: [{ translateX }] },
      ]}
    >
      {isMain && showPortrait && (
        <View style={[styles.portrait, { backgroundColor: nameColor + '40', borderColor: nameColor }]}>
          <Text style={[styles.portraitInitial, { color: nameColor }]}>{initial}</Text>
        </View>
      )}

      <View style={{ maxWidth: MAX_W }}>
        <Text style={[styles.bubbleName, { color: nameColor, textAlign: isMain ? 'left' : 'right' }]}>
          {line.character.toUpperCase()}
        </Text>
        <View style={[
          styles.bubble,
          { backgroundColor: bubbleTint },
          isMain ? styles.bubbleLeft : styles.bubbleRight,
        ]}>
          <View style={[
            styles.tail,
            isMain ? styles.tailLeft : styles.tailRight,
            { borderBottomColor: bubbleTint },
          ]} />
          <Text style={styles.bubbleText}>
            {text}{showCursor ? <Text style={styles.cursor}>|</Text> : ''}
          </Text>
        </View>
      </View>

      {!isMain && showPortrait && (
        <View style={[styles.portrait, { backgroundColor: nameColor + '40', borderColor: nameColor }]}>
          <Text style={[styles.portraitInitial, { color: nameColor }]}>{initial}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Chapter milestone ─────────────────────────────────────────
function chapterLabel(sceneNumber: number, total: number): string | null {
  if (sceneNumber === 1) return 'Chapter 1 — The Beginning';
  const pct = sceneNumber / total;
  if (Math.abs(pct - 0.33) < 0.05) return 'Chapter 2 — Rising Action';
  if (Math.abs(pct - 0.66) < 0.05) return 'Chapter 3 — The Climax';
  if (sceneNumber === total) return 'Chapter 4 — The Ending';
  return null;
}

// ─────────────────────────────────────────────────────────────
export default function SceneScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { storyId, sceneNumber } = route.params;
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const activeStory     = useStoryStore((s) => s.activeStory);
  const currentScene    = useStoryStore((s) => s.currentScene);
  const setCurrentScene = useStoryStore((s) => s.setCurrentScene);
  const setActiveStory  = useStoryStore((s) => s.setActiveStory);
  const setUndoAvail    = useStoryStore((s) => s.setUndoAvailable);
  const creditBalance        = useCreditStore((s) => s.balance);
  const storeDeductCredits   = useCreditStore((s) => s.deductCredits);
  const newStageEnabled = useFeatureFlagStore((s) => s.isEnabled('new_stage_v2'));

  const [scene, setScene]       = useState<Scene | null>(currentScene ?? null);
  const [nextScene, setNextScene] = useState<Scene | null>(null);
  const [nextScenePrefetched, setNextScenePrefetched] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [showTransitionButton, setShowTransitionButton] = useState(false);
  const [transitionBtnEnabled, setTransitionBtnEnabled] = useState(false);
  const [countdownStep, setCountdownStep] = useState(1);

  const [stage, dispatch] = useReducer(stageReducer, {
    phase: 'reading',
    visibleBubbles: 0,
    typedTexts: [],
    isTyping: false,
    showCursor: true,
    choicesRevealed: false,
    dialoguePaused: false,
    fillerStart: null,
    nextSceneReady: false,
    choiceIndex: null,
  });

  // Refs
  const abortRef          = useRef<AbortController | null>(null);
  const typingRef         = useRef(false);
  const isMountedRef      = useRef(true);
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount         = useRef(0);
  const sceneMountedAt    = useRef<number>(Date.now());
  const choiceTapAt       = useRef<number | null>(null);
  const pendingRequestRef        = useRef<AbortController | null>(null);
  const charOrder                = useRef<string[]>([]);
  const transitionTimerRef       = useRef<ReturnType<typeof setTimeout>[]>([]);
  const transitionBtnTriggeredRef = useRef(false);
  const pendingChoiceRef         = useRef<{ choice: string | null; freeformText: string | null } | null>(null);

  // Animated
  const slideAnims     = useRef<Animated.Value[]>([]);
  const choicesSlide   = useRef(new Animated.Value(0)).current;
  const choicesPulse   = useRef(new Animated.Value(1)).current;
  const reactionAnim   = useRef(new Animated.Value(0)).current;
  const tintAnim       = useRef(new Animated.Value(0)).current;
  const letterboxAnim  = useRef(new Animated.Value(0)).current;
  const titleRevealAnim = useRef(new Animated.Value(0)).current;
  const titleShown     = useRef(false);
  const chapterAnim    = useRef(new Animated.Value(0)).current;
  const moodScaleAnim  = useRef(new Animated.Value(1)).current;
  const prevTension    = useRef<number | undefined>(undefined);
  const crossfadeAnim  = useRef(new Animated.Value(0)).current;

  // Overlays
  const [reactionEmoji, setReactionEmoji] = useState<string | null>(null);
  const [tintColor, setTintColor] = useState('rgba(0,0,0,0)');
  const [showLetterbox, setShowLetterbox] = useState(false);
  const [showTitleReveal, setShowTitleReveal] = useState(false);
  const [chapterText, setChapterText] = useState<string | null>(null);
  const [showSkipHint, setShowSkipHint] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const genre = activeStory?.genre;
  const genreMeta = getGenreMeta(genre);
  const genreColor = genreMeta.primary;

  // Which dialogue array is active based on phase
  const activeDialogue: Array<{ character: string; line: string; emotion?: string; beat_ms?: number }> =
    stage.phase === 'stall_filler'
      ? (scene?.filler_dialogue ?? [])
      : (scene?.dialogue ?? []);

  function isMainChar(name: string) {
    return charOrder.current.indexOf(name) === 0;
  }

  // ── Init + cleanup ────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      pendingRequestRef.current?.abort();
      if (pollRef.current) clearInterval(pollRef.current);
      transitionTimerRef.current.forEach(clearTimeout);
    };
  }, []);

  // ── Fetch scene if not in store ───────────────────────────
  useEffect(() => {
    if (currentScene?.scene_number === sceneNumber) {
      setScene(currentScene);
      dispatch({ type: 'init', dialogueLength: currentScene.dialogue?.length ?? 0 });
      sceneMountedAt.current = Date.now();
    } else {
      fetchScene();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchScene() {
    try {
      const { data } = await api.get(`/stories/${storyId}/scenes-current`);
      if (data?.scene) {
        setScene(data.scene);
        setCurrentScene(data.scene);
        dispatch({ type: 'init', dialogueLength: data.scene.dialogue?.length ?? 0 });
        sceneMountedAt.current = Date.now();
      }
      if (!activeStory) {
        const { data: sd } = await api.get(`/stories/${storyId}`);
        if (sd?.story) setActiveStory(sd.story);
      }
    } catch { /* keep */ }
  }

  // ── AppState (pause/resume on background) ─────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, stage.phase]);

  const backgroundedAt = useRef<number | null>(null);

  function onAppStateChange(next: AppStateStatus) {
    if (next === 'background' || next === 'inactive') {
      backgroundedAt.current = Date.now();
      abortRef.current?.abort(); // pause typewriter
      // Persist minimal state
      if (scene) {
        const payload = {
          storyId, sceneId: scene.id, phase: stage.phase,
          visibleBubbles: stage.visibleBubbles,
          typedTexts: stage.typedTexts,
          backgroundedAt: backgroundedAt.current,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
      }
    } else if (next === 'active') {
      const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (elapsed > 60_000) {
        // Stale: reload
        fetchScene();
        return;
      }
      // Resume typewriter from where we left off (only if still in a typing phase)
      if ((stage.phase === 'reading' || (stage.phase === 'stall_filler' && stage.visibleBubbles === 0)) && scene && !typingRef.current) {
        startTypewriter(stage.phase === 'stall_filler' ? 'filler' : 'dialogue');
      }
    }
  }

  // ── Poll for image when scene has no URL ──────────────────
  useEffect(() => {
    if (!scene) return;
    // Reset the budget every time the displayed scene id changes — otherwise
    // a single exhausted run would permanently disable image polling for the
    // rest of the story.
    pollCount.current = 0;
    if (scene.image_url) return;
    const targetSceneId = scene.id;
    pollRef.current = setInterval(async () => {
      pollCount.current++;
      if (pollCount.current >= IMAGE_POLL_MAX) { clearInterval(pollRef.current!); return; }
      try {
        const { data } = await api.get(`/stories/${storyId}/scenes-current`);
        // Validate the returned row matches the scene we're actually displaying —
        // /scenes-current returns the newest row, which could race with an undo
        // or a concurrent pregen write and hand us the wrong image.
        if (data?.scene?.id === targetSceneId && data.scene.image_url) {
          try { await Image.prefetch(data.scene.image_url); } catch { /* ignore */ }
          setScene(prev => (prev && prev.id === targetSceneId
            ? { ...prev, image_url: data.scene.image_url }
            : prev));
          clearInterval(pollRef.current!);
        }
      } catch { /* ignore */ }
    }, IMAGE_POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, scene?.image_url]);

  // ── Weather overlay ───────────────────────────────────────
  useEffect(() => {
    if (!scene) return;
    const s = scene as Scene;
    const newTint = weatherTint(s.time_of_day, s.weather);
    setTintColor(newTint);
    Animated.timing(tintAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
  }, [scene?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Letterbox bars ────────────────────────────────────────
  useEffect(() => {
    if (!scene) return;
    const shouldShow = (scene.story_tension_score ?? 0) > 70 || scene.twist_occurred;
    if (shouldShow !== showLetterbox) {
      setShowLetterbox(shouldShow);
      Animated.timing(letterboxAnim, {
        toValue: shouldShow ? 1 : 0,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    }
  }, [scene?.id, scene?.story_tension_score, scene?.twist_occurred]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Title reveal (scene 3) ────────────────────────────────
  useEffect(() => {
    if (scene?.scene_number === 3 && activeStory?.title && !titleShown.current) {
      titleShown.current = true;
      setTimeout(() => {
        setShowTitleReveal(true);
        SoundService.play('titleReveal', 0.7);
        Animated.sequence([
          Animated.timing(titleRevealAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.delay(2800),
          Animated.timing(titleRevealAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start(() => setShowTitleReveal(false));
      }, 500);
    }
  }, [scene?.scene_number]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chapter milestone ─────────────────────────────────────
  useEffect(() => {
    if (!scene || !activeStory) return;
    const label = chapterLabel(scene.scene_number, activeStory.total_scenes);
    if (label) {
      setChapterText(label);
      Animated.sequence([
        Animated.timing(chapterAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(chapterAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setChapterText(null));
    }
  }, [scene?.scene_number]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mood meter pulse ──────────────────────────────────────
  useEffect(() => {
    if (!scene) return;
    const t = scene.story_tension_score;
    if (t !== prevTension.current) {
      prevTension.current = t;
      Animated.sequence([
        Animated.timing(moodScaleAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.spring(moodScaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
    }
  }, [scene?.story_tension_score]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Twist haptic ──────────────────────────────────────────
  useEffect(() => {
    if (scene?.twist_occurred) HapticService.twistReveal();
  }, [scene?.twist_occurred]);

  // ── Typewriter lifecycle: starts when scene or phase changes ─
  useEffect(() => {
    if (!scene) return;
    // On scene change: reset char order + slide anims, then start dialogue typewriter
    charOrder.current = [];
    (scene.dialogue ?? []).forEach(d => {
      if (!charOrder.current.includes(d.character)) charOrder.current.push(d.character);
    });
    dispatch({ type: 'reset_for_new_scene', dialogueLength: scene.dialogue?.length ?? 0 });
    slideAnims.current = (scene.dialogue ?? []).map(() => new Animated.Value(0));
    sceneMountedAt.current = Date.now();
    const t = setTimeout(() => startTypewriter('dialogue'), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  async function startTypewriter(which: 'dialogue' | 'filler') {
    if (typingRef.current) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    typingRef.current = true;

    const lines = which === 'filler'
      ? (scene?.filler_dialogue ?? [])
      : (scene?.dialogue ?? []);

    // Ensure slide anims exist for the current line list
    slideAnims.current = lines.map(() => new Animated.Value(0));

    try {
      for (let i = 0; i < lines.length; i++) {
        if (ctrl.signal.aborted || !isMountedRef.current) return;

        // Dialogue-only: reveal choices at CHOICE_REVEAL_AT and pause
        if (which === 'dialogue' && i === CHOICE_REVEAL_AT && !stage.choicesRevealed) {
          dispatch({ type: 'reveal_choices' });
          SoundService.play('choicesAppear', 0.6);
          Animated.spring(choicesSlide, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
          Animated.loop(
            Animated.sequence([
              Animated.timing(choicesPulse, { toValue: 1.03, duration: 700, useNativeDriver: true }),
              Animated.timing(choicesPulse, { toValue: 1.0,  duration: 700, useNativeDriver: true }),
            ])
          ).start();
          typingRef.current = false;
          return; // pause — resume via resumeDialogue()
        }

        dispatch({ type: 'show_bubble', index: i });
        SoundService.play('bubbleAppear', 0.4);
        Animated.timing(slideAnims.current[i], {
          toValue: 1, duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();

        const emotion = lines[i].emotion;
        if (emotion) SoundService.playEmotionSound(emotion);

        const fullText = lines[i].line ?? '';
        for (let c = 0; c <= fullText.length; c++) {
          if (ctrl.signal.aborted || !isMountedRef.current) return;
          await sleep(TYPEWRITER_MS, ctrl.signal);
          SoundService.playTypewriterTick();
          dispatch({
            type: 'type_progress',
            index: i,
            text: fullText.slice(0, c),
            cursor: c < fullText.length,
          });
        }
        dispatch({ type: 'type_done', index: i });

        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

        if (i < lines.length - 1) {
          const pause = (lines[i] as any).beat_ms ?? BUBBLE_PAUSE_MS;
          await sleep(pause, ctrl.signal);
        }
      }
    } finally {
      typingRef.current = false;
    }

    if (which === 'dialogue' && !stage.choicesRevealed) {
      dispatch({ type: 'reveal_choices' });
      SoundService.play('choicesAppear', 0.6);
      Animated.spring(choicesSlide, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(choicesPulse, { toValue: 1.03, duration: 700, useNativeDriver: true }),
          Animated.timing(choicesPulse, { toValue: 1.0,  duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
    // Filler typewriter ended: show transition button
    console.log('[DEBUG] startTypewriter end reached, which=', which);
    if (which === 'filler') triggerTransitionButton();
  }

  // Resume pre-choice dialogue after user chose.
  // Returns a Promise that resolves when the remaining dialogue has finished typing
  // (or aborts cleanly if the controller is aborted).
  async function resumeDialogueAfterChoice(): Promise<void> {
    dispatch({ type: 'resume_dialogue' });
    if (!scene) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    typingRef.current = true;

    const lines = scene.dialogue ?? [];
    try {
      for (let i = CHOICE_REVEAL_AT; i < lines.length; i++) {
        if (ctrl.signal.aborted || !isMountedRef.current) return;
        dispatch({ type: 'show_bubble', index: i });
        SoundService.play('bubbleAppear', 0.4);
        slideAnims.current[i]?.setValue(0);
        Animated.timing(slideAnims.current[i], {
          toValue: 1, duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
        const emotion = lines[i].emotion;
        if (emotion) SoundService.playEmotionSound(emotion);

        const fullText = lines[i].line ?? '';
        for (let c = 0; c <= fullText.length; c++) {
          if (ctrl.signal.aborted || !isMountedRef.current) return;
          await sleep(TYPEWRITER_MS, ctrl.signal);
          SoundService.playTypewriterTick();
          dispatch({
            type: 'type_progress',
            index: i,
            text: fullText.slice(0, c),
            cursor: c < fullText.length,
          });
        }
        dispatch({ type: 'type_done', index: i });
        if (i < lines.length - 1) await sleep(BUBBLE_PAUSE_MS, ctrl.signal);
      }
    } finally {
      typingRef.current = false;
    }
  }

  // ── Choice handler ────────────────────────────────────────
  const handleChoice = useCallback(async (choice: string, choiceIndex: number, opts?: { isFreeform?: boolean; text?: string }) => {
    if (choosing) return;
    setChoosing(true);
    pendingChoiceRef.current = { choice: opts?.isFreeform ? null : choice, freeformText: opts?.isFreeform ? (opts.text ?? null) : null };
    choiceTapAt.current = Date.now();
    HapticService.choiceTap();

    // Reaction emoji
    const s = scene as any;
    const emoji = s?.choice_reaction?.emoji ?? '⚡';
    setReactionEmoji(emoji);
    reactionAnim.setValue(0);
    Animated.sequence([
      Animated.spring(reactionAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(reactionAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setReactionEmoji(null));

    Animated.timing(choicesSlide, { toValue: 0, duration: 150, useNativeDriver: true }).start();

    // Legacy path: if flag off OR scene has no filler_dialogue, use old navigation
    const fillerCount = scene?.filler_dialogue?.length ?? 0;
    const useNewStage = newStageEnabled && fillerCount >= 3 && !scene?.is_final_scene;
    console.log('[DEBUG] handleChoice gate', { newStageEnabled, fillerCount, isFinal: scene?.is_final_scene, useNewStage });

    if (!useNewStage) {
      // Preserve existing visual feel: resume remaining dialogue, then navigate
      resumeDialogueAfterChoice();
      setTimeout(() => {
        const params: any = { storyId };
        if (opts?.isFreeform && opts.text) params.playerTextInput = opts.text;
        else params.playerChoice = choice;
        navigation.navigate('LoadingScene', { ...params, reason: 'first_scene' } as any);
      }, 3500);
      return;
    }

    // ── NEW STAGE: begin stall_filler + fire request ────────
    dispatch({ type: 'begin_choosing', choiceIndex });

    // Fire the request immediately (parallel with dialogue tail)
    const reqCtrl = new AbortController();
    pendingRequestRef.current = reqCtrl;
    const body: any = {};
    if (opts?.isFreeform && opts.text) body.player_text_input = opts.text;
    else body.player_choice = choice;
    if (typeof choiceIndex === 'number' && choiceIndex >= 0) body.choice_index = choiceIndex;

    const requestPromise: Promise<any> = api.post(`/stories/${storyId}/scenes`, body, {
      signal: reqCtrl.signal as any,
      headers: { 'x-app-state': 'foreground' },
    }).then(r => r.data).catch(err => ({ __error: err }));

    // Chain: resume dialogue tail → begin filler → run filler typewriter
    (async () => {
      try {
        await resumeDialogueAfterChoice();
      } catch { /* aborted — bail */ return; }
      if (!isMountedRef.current) return;
      const fillerLines = scene?.filler_dialogue ?? [];
      if (fillerLines.length === 0) {
        // Shouldn't happen (we gated on fillerCount >= 3), but be safe:
        dispatch({ type: 'show_overflow' });
        return;
      }
      dispatch({ type: 'begin_filler', fillerLength: fillerLines.length });
      startTypewriter('filler');
    })();

    // When request resolves, stash nextScene + prefetch image
    (async () => {
      const data = await requestPromise;
      if (!isMountedRef.current) return;

      if (data?.__error) {
        const httpStatus = data.__error?.response?.status;
        if (httpStatus === 402) {
          dispatch({ type: 'restore_choices' });
          setChoosing(false);
          Alert.alert('Not enough credits', 'A free choice costs ◆ 10 credits.');
          return;
        }
        console.warn('[SceneScreen] request failed', data.__error?.message);
        dispatch({ type: 'show_overflow' });
        setTimeout(() => {
          navigation.navigate('LoadingScene', {
            storyId,
            playerChoice: opts?.isFreeform ? undefined : choice,
            playerTextInput: opts?.isFreeform ? opts.text : undefined,
            reason: 'stall_overflow',
          } as any);
        }, 400);
        return;
      }

      if (data?.scene) {
        if (opts?.isFreeform) storeDeductCredits(10);
        setNextScene(data.scene);
        if (data.scene.image_url) {
          for (const delayMs of PREFETCH_BACKOFF_MS) {
            if (!isMountedRef.current) return;
            if (delayMs > 0) await sleep(delayMs);
            try {
              await Image.prefetch(data.scene.image_url);
              setNextScenePrefetched(true);
              break;
            } catch { /* retry */ }
          }
        } else {
          pollForNextImage(data.scene.id);
        }
        dispatch({ type: 'next_scene_ready' });
        evaluateCrossfade();
      }
    })();
  }, [choosing, scene, newStageEnabled, navigation, storyId, storeDeductCredits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for nextScene image if not present yet (bundle miss)
  async function pollForNextImage(sceneId: string) {
    for (let i = 0; i < 20; i++) {
      if (!isMountedRef.current) return;
      await sleep(2500);
      try {
        const { data } = await api.get(`/stories/${storyId}/scenes-current`);
        if (data?.scene?.id === sceneId && data.scene.image_url) {
          setNextScene(prev => prev ? { ...prev, image_url: data.scene.image_url } : prev);
          try { await Image.prefetch(data.scene.image_url); setNextScenePrefetched(true); } catch { /* ignore */ }
          return;
        }
      } catch { /* ignore */ }
    }
  }

  // ── Evaluate whether to crossfade ─────────────────────────
  function evaluateCrossfade() {
    if (stage.phase !== 'stall_filler') return;
    if (transitionBtnTriggeredRef.current) return;
    const fillerStart = stage.fillerStart ?? Date.now();
    const elapsed = Date.now() - fillerStart;

    if (elapsed >= MAX_FILLER_MS) {
      triggerTransitionButton();
    } else {
      setTimeout(evaluateCrossfade, 500);
    }
  }

  // React to next-scene readiness
  useEffect(() => {
    if (stage.phase === 'stall_filler' && nextScene && nextScenePrefetched) {
      evaluateCrossfade();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextScene?.id, nextScenePrefetched, stage.phase]);

  function beginCrossfade() {
    abortRef.current?.abort(); // stop any remaining typewriter
    dispatch({ type: 'begin_crossfade' });
    HapticService.stageTransition();
    Animated.timing(crossfadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start(() => {
      if (!isMountedRef.current || !nextScene) return;
      // Swap: next becomes current
      const swapped = nextScene;
      setScene(swapped);
      setCurrentScene(swapped);
      setNextScene(null);
      setNextScenePrefetched(false);
      setChoosing(false);
      setShowTransitionButton(false);
      setTransitionBtnEnabled(false);
      setCountdownStep(1);
      transitionBtnTriggeredRef.current = false;
      transitionTimerRef.current.forEach(clearTimeout);
      transitionTimerRef.current = [];

      // Log perceived wait
      if (choiceTapAt.current) {
        const wait = Date.now() - choiceTapAt.current;
        console.log('[stage.perceived_wait_ms]', {
          storyId, sceneNumber: swapped.scene_number, ms: wait,
        });
      }

      crossfadeAnim.setValue(0);

      // If terminal scene → route to Ending
      if (swapped.is_final_scene) {
        navigation.replace('Ending', { storyId });
        return;
      }
      // Reset state machine + refetch active story for tension/total/etc
      api.get(`/stories/${storyId}`).then(({ data: sd }) => {
        if (isMountedRef.current && sd?.story) setActiveStory(sd.story);
      }).catch(() => {});
      setUndoAvail(swapped.scene_number > 1 && !swapped.is_undo_snapshot);
    });
  }

  // ── Handlers for choice UI ────────────────────────────────
  const onTapChoice = (choice: string, index: number) => handleChoice(choice, index);
  const onTapFreeform = (text: string) => handleChoice(text, -1, { isFreeform: true, text });

  // ── Skip filler long-press (second press confirms) ────────
  const [skipArmed, setSkipArmed] = useState(false);
  function onSkipLongPress() {
    if (stage.phase !== 'stall_filler') return;
    HapticService.longPress();
    setSkipArmed(true);
    setShowSkipHint(true);
    setTimeout(() => { setSkipArmed(false); setShowSkipHint(false); }, 3000);
  }
  function onSkipTap() {
    if (!skipArmed || stage.phase !== 'stall_filler') return;
    setSkipArmed(false);
    setShowSkipHint(false);
    abortRef.current?.abort();
    if (nextScene && nextScenePrefetched) beginCrossfade();
  }

  function triggerTransitionButton() {
    console.log('[DEBUG] triggerTransitionButton called, alreadyTriggered=', transitionBtnTriggeredRef.current);
    if (transitionBtnTriggeredRef.current) return;
    transitionBtnTriggeredRef.current = true;
    setShowTransitionButton(true);
    console.log('[DEBUG] showTransitionButton set to true');
    const t1 = setTimeout(() => setCountdownStep(2), 1750);
    const t2 = setTimeout(() => setCountdownStep(3), 3500);
    const t3 = setTimeout(() => setCountdownStep(4), 5250);
    const t4 = setTimeout(() => { console.log('[DEBUG] transitionBtnEnabled set to true'); setTransitionBtnEnabled(true); }, 7000);
    transitionTimerRef.current = [t1, t2, t3, t4];
  }

  function onTransitionButtonTap() {
    if (!transitionBtnEnabled) return;
    if (nextScene) {
      beginCrossfade();
    } else {
      navigation.navigate('LoadingScene', {
        storyId,
        playerChoice:     pendingChoiceRef.current?.choice ?? undefined,
        playerTextInput:  pendingChoiceRef.current?.freeformText ?? undefined,
        reason: 'stall_overflow',
      } as any);
    }
  }

  // ── Render ────────────────────────────────────────────────
  if (!scene) {
    return (
      <View style={[styles.loadingFull, { backgroundColor: colors.bg }]}>
        <Plumbob size={56} animated />
      </View>
    );
  }

  const total    = activeStory?.total_scenes ?? 1;
  const choices  = scene.choices ?? [];
  const imageUri = scene.image_url ?? null;
  const nextImageUri = nextScene?.image_url ?? null;
  const mood     = deriveMood(scene.story_tension_score, genre);
  const letterboxH = letterboxAnim.interpolate({ inputRange: [0,1], outputRange: [0, 60] });

  const showPreChoiceDialogue = stage.phase === 'reading' || stage.phase === 'choosing';
  const showFillerDialogue    = stage.phase === 'stall_filler' || stage.phase === 'crossfade';

  return (
    <View style={styles.screen}>
      {/* ── Dual-buffered image layers ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: genreColor }]}>
        {!imageUri && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
            <Plumbob size={80} animated color={genreColor} />
          </View>
        )}
      </View>
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
          onError={() => setScene(prev => prev ? { ...prev, image_url: null } : prev)}
        />
      )}
      {/* Next-scene image layered on top, faded in during crossfade */}
      {nextImageUri && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: crossfadeAnim, backgroundColor: genreColor + '33' }]}
          pointerEvents="none"
        >
          <Image
            source={{ uri: nextImageUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            onError={() => setNextScene(prev => prev ? { ...prev, image_url: null } : prev)}
          />
        </Animated.View>
      )}

      {/* Weather tint */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: tintColor }]} pointerEvents="none" />
      <View style={styles.bottomGradient} pointerEvents="none" />
      <View style={styles.topGradient} pointerEvents="none" />

      {/* Letterbox */}
      <Animated.View style={[styles.letterboxTop, { height: letterboxH }]} pointerEvents="none" />
      <Animated.View style={[styles.letterboxBottom, { height: letterboxH }]} pointerEvents="none" />

      {/* Top HUD */}
      <View style={[styles.topHud, { paddingTop: insets.top + 8 }]}>
        <Animated.View style={[styles.moodPill, { transform: [{ scale: moodScaleAnim }] }]}>
          <Text style={styles.moodIcon}>{mood.icon}</Text>
          <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
        </Animated.View>

        <PlumbobCounter current={scene.scene_number} total={total} color={genreColor} />

        <TouchableOpacity
          style={styles.creditPill}
          onPress={() => navigation.navigate('Tabs' as any)}
          activeOpacity={0.8}
        >
          <Text style={[styles.creditPillText, creditBalance < 20 && styles.creditPillRed]}>
            ◆ {creditBalance}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dialogue bubbles (pre-choice) */}
      {showPreChoiceDialogue && (
        <ScrollView
          ref={scrollRef}
          style={styles.bubblesScroll}
          contentContainerStyle={[
            styles.bubblesContent,
            { paddingBottom: stage.choicesRevealed ? 220 : 80 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!stage.isTyping}
          bounces={false}
        >
          {(scene.dialogue ?? []).slice(0, stage.visibleBubbles).map((line, i) => {
            const isMain = isMainChar(line.character);
            const prevLine = i > 0 ? scene.dialogue[i - 1] : null;
            const showPortrait = !prevLine || prevLine.character !== line.character;
            const slideAnim = slideAnims.current[i] ?? new Animated.Value(1);
            return (
              <ChatBubble
                key={`d-${i}`}
                line={{ ...line, emotion: line.emotion }}
                isMain={isMain}
                showPortrait={showPortrait}
                text={stage.typedTexts[i] ?? ''}
                showCursor={stage.isTyping && i === stage.visibleBubbles - 1}
                slideAnim={slideAnim}
                screenWidth={screenW}
              />
            );
          })}
        </ScrollView>
      )}

      {/* Filler bubbles (post-choice) — new stage only */}
      {showFillerDialogue && (
        <Pressable
          style={styles.bubblesScroll}
          onLongPress={onSkipLongPress}
          onPress={skipArmed ? onSkipTap : undefined}
          delayLongPress={500}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.bubblesContent, { paddingBottom: 80 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {(scene.filler_dialogue ?? []).slice(0, stage.visibleBubbles).map((line, i) => {
              const isMain = isMainChar(line.character);
              const prevLine = i > 0 ? (scene.filler_dialogue ?? [])[i - 1] : null;
              const showPortrait = !prevLine || prevLine.character !== line.character;
              const slideAnim = slideAnims.current[i] ?? new Animated.Value(1);
              return (
                <ChatBubble
                  key={`f-${i}`}
                  line={line}
                  isMain={isMain}
                  showPortrait={showPortrait}
                  text={stage.typedTexts[i] ?? ''}
                  showCursor={stage.isTyping && i === stage.visibleBubbles - 1}
                  slideAnim={slideAnim}
                  screenWidth={screenW}
                />
              );
            })}
          </ScrollView>
          {showSkipHint && (
            <View style={styles.skipHint} pointerEvents="none">
              <Text style={styles.skipHintText}>Tap to skip →</Text>
            </View>
          )}
        </Pressable>
      )}
      {stage.phase === 'stall_filler' && showTransitionButton && (
        <View style={styles.transitionBtnWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.transitionBtn, transitionBtnEnabled && { borderColor: genreColor }]}
            onPress={onTransitionButtonTap}
            disabled={!transitionBtnEnabled}
            activeOpacity={0.8}
          >
            <Text style={[styles.transitionBtnText, transitionBtnEnabled && { color: '#fff' }]}>
              {countdownStep}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Choices (only in reading phase) */}
      {stage.phase === 'reading' && stage.choicesRevealed && choices.length > 0 && (
        <Animated.View
          style={[
            styles.choicesContainer,
            { paddingBottom: insets.bottom + 12 },
            {
              transform: [{ translateY: choicesSlide.interpolate({ inputRange: [0,1], outputRange: [200, 0] }) }],
              opacity: choicesSlide,
            },
          ]}
          pointerEvents={stage.phase === 'reading' ? 'auto' : 'none'}
        >
          <GlassView
            intensity={80}
            tint="dark"
            androidFallbackColor="rgba(0,0,0,0.65)"
            style={StyleSheet.absoluteFillObject}
          >
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.20)' }]} />
          </GlassView>
          <Animated.View style={{ transform: [{ scale: choicesPulse }] }}>
            <Text style={styles.choicesLabel}>✨ Your Choice</Text>
          </Animated.View>
          {choices.map((choice, i) => (
            <ChoiceButton
              key={i}
              choice={choice}
              index={i}
              hint={(scene as any).choice_hints?.[i]}
              disabled={choosing}
              onPress={() => onTapChoice(choice, i)}
              borderColor={genreColor}
            />
          ))}
          {scene.can_text_input ? (
            <FreeformChoiceSheet
              disabled={choosing}
              onSubmit={onTapFreeform}
              borderColor={genreColor}
              canAfford={creditBalance >= 10}
            />
          ) : (
            <View style={styles.freeformLocked}>
              <Text style={styles.freeformLockedText}>✏ Free choice — not this scene</Text>
              <Text style={styles.freeformLockedCost}>◆ 10</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Overflow overlay (rare) */}
      {stage.phase === 'loading_overflow' && (
        <View style={styles.overflowOverlay}>
          <Plumbob size={56} animated color={genreColor} />
          <Text style={styles.overflowText}>Catching up…</Text>
        </View>
      )}

      {/* Reaction emoji */}
      {reactionEmoji && (
        <Animated.View
          style={[styles.reactionWrap, {
            transform: [{ scale: reactionAnim.interpolate({ inputRange:[0,1], outputRange:[0.3,1.3] }) }],
            opacity: reactionAnim,
          }]}
          pointerEvents="none"
        >
          <Text style={styles.reactionEmoji}>{reactionEmoji}</Text>
        </Animated.View>
      )}

      {/* Chapter milestone */}
      {chapterText && (
        <Animated.View style={[styles.chapterOverlay, { opacity: chapterAnim }]} pointerEvents="none">
          <View style={[styles.chapterCard, { borderColor: genreColor }]}>
            <Text style={[styles.chapterText, { color: genreColor }]}>{chapterText}</Text>
          </View>
        </Animated.View>
      )}

      {/* Title reveal */}
      {showTitleReveal && activeStory?.title && (
        <Animated.View style={[styles.titleOverlay, { opacity: titleRevealAnim }]} pointerEvents="none">
          <Text style={styles.titleRevealSub}>YOUR STORY HAS A NAME...</Text>
          <Text style={styles.titleRevealTitle}>{activeStory.title}</Text>
          <View style={[styles.titleLine, { backgroundColor: colors.plumbob }]} />
        </Animated.View>
      )}
    </View>
  );
}

// ── PlumbobCounter ────────────────────────────────────────────
function PlumbobCounter({ current, total, color }: { current: number; total: number; color: string }) {
  const MAX_SHOWN = 20;
  const count = Math.min(total, MAX_SHOWN);
  const scale = total > MAX_SHOWN ? (20 / total) : 1;
  return (
    <View style={styles.diamondRow}>
      {Array.from({ length: count }).map((_, i) => {
        const sceneIdx = i + 1;
        const filled = sceneIdx < current;
        const active = sceneIdx === current;
        return (
          <View key={i} style={[
            styles.diamond,
            { borderColor: color, transform: [{ scale }] },
            filled && { backgroundColor: color },
            active && { backgroundColor: color, opacity: 1 },
          ]} />
        );
      })}
    </View>
  );
}

// ── ChoiceButton ──────────────────────────────────────────────
function ChoiceButton({ choice, index, hint, disabled, onPress, borderColor }: {
  choice: string; index: number; hint?: string;
  disabled: boolean; onPress: () => void; borderColor: string;
}) {
  const [showHint, setShowHint] = useState(false);
  const pressAnim = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.timing(pressAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }).start();
  }
  function handlePressOut() {
    Animated.spring(pressAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }
  function handleLongPress() {
    HapticService.longPress();
    setShowHint(true);
    setTimeout(() => setShowHint(false), 3000);
  }

  return (
    <View style={styles.choiceBtnWrap}>
      {showHint && hint && (
        <View style={styles.hintTooltip}>
          <Text style={styles.hintText}>{hint}</Text>
          <View style={styles.hintArrow} />
        </View>
      )}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        disabled={disabled}
      >
        <Animated.View style={[
          styles.choiceBtn,
          { borderColor: borderColor + '80' },
          disabled && { opacity: 0.5 },
          { transform: [{ scale: pressAnim }] },
        ]}>
          <View style={[styles.choiceIndex, { backgroundColor: borderColor }]}>
            <Text style={styles.choiceIndexText}>{String.fromCharCode(65 + index)}</Text>
          </View>
          <Text style={styles.choiceText} numberOfLines={3}>{choice}</Text>
          <Text style={styles.choiceArrow}>›</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ── FreeformChoiceSheet (Type A only) ─────────────────────────
function FreeformChoiceSheet({ disabled, onSubmit, borderColor, canAfford }: {
  disabled: boolean;
  onSubmit: (text: string) => void;
  borderColor: string;
  canAfford: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText]         = useState('');
  const heightAnim = useRef(new Animated.Value(0)).current;

  const expand = () => {
    if (!canAfford) return;
    setExpanded(true);
    Animated.timing(heightAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
  };
  const collapse = () => {
    setExpanded(false);
    Keyboard.dismiss();
    Animated.timing(heightAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };
  const submit = () => {
    const t = text.trim();
    if (!t || !canAfford) return;
    Keyboard.dismiss();
    onSubmit(t);
  };

  const triggerColor = canAfford ? borderColor : 'rgba(255,255,255,0.3)';

  return (
    <View style={styles.freeformWrap}>
      {!expanded && (
        <TouchableOpacity
          onPress={expand}
          disabled={disabled || !canAfford}
          activeOpacity={0.8}
          style={styles.freeformTrigger}
        >
          <Text style={[styles.freeformTriggerText, { color: triggerColor }]}>
            ⌨ Or type your own action…
          </Text>
          <Text style={[styles.freeformCostBadge, { color: triggerColor }]}>
            {canAfford ? '◆ 10' : '◆ 10 — Need more'}
          </Text>
        </TouchableOpacity>
      )}
      {expanded && (
        <Animated.View style={[styles.freeformExpanded, { borderColor: borderColor + '80', opacity: heightAnim }]}>
          <TextInput
            style={styles.freeformInput}
            value={text}
            onChangeText={setText}
            maxLength={120}
            placeholder="I want to…"
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
          />
          <View style={styles.freeformActions}>
            <Text style={styles.freeformCount}>{text.length}/120</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={collapse} style={styles.freeformCancel}>
                <Text style={styles.freeformCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submit}
                disabled={disabled || !text.trim() || !canAfford}
                style={[styles.freeformSend, { backgroundColor: borderColor, opacity: (text.trim() && canAfford) ? 1 : 0.4 }]}
              >
                <Text style={styles.freeformSendText}>Send ◆ 10</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#000' },
  loadingFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  letterboxTop:    { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#000' },
  letterboxBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000' },

  topHud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 8, zIndex: 10,
  },
  moodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  moodIcon:  { fontSize: 11 },
  moodLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  diamondRow: { flex: 1, flexDirection: 'row', gap: 3, alignItems: 'center', flexWrap: 'wrap' },
  diamond: {
    width: 8, height: 8, borderRadius: 2,
    borderWidth: 0.5, transform: [{ rotate: '45deg' }],
    backgroundColor: 'transparent', opacity: 0.6,
  },

  creditPill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  creditPillText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  creditPillRed:  { color: '#EF4444' },

  bubblesScroll: { flex: 1, marginTop: 100, zIndex: 5 },
  bubblesContent: { paddingHorizontal: 14, paddingTop: 10, gap: 12 },

  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%' },
  bubbleRowLeft:  { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },

  portrait: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 0.5, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  portraitInitial: { fontSize: 14, fontWeight: '900' },

  bubbleName: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3,
    color: '#fff',
  },
  bubble: {
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
    position: 'relative',
  },
  bubbleLeft:  { borderTopLeftRadius: 4 },
  bubbleRight: { borderTopRightRadius: 4 },

  tail: {
    position: 'absolute', top: 0,
    width: 0, height: 0,
    borderLeftWidth: 0, borderRightWidth: 12, borderBottomWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  tailLeft:  { left: -8, borderTopLeftRadius: 0 },
  tailRight: { right: -8, borderLeftWidth: 12, borderRightWidth: 0, borderRightColor: 'transparent', borderLeftColor: 'transparent' },

  bubbleText: {
    fontSize: 15, color: '#FFFFFF',
    lineHeight: 22, fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cursor: { color: '#FFFFFF', fontWeight: '100' },

  choicesContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingTop: 12, gap: 8,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    zIndex: 20,
  },
  choicesLabel: {
    fontSize: 11, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: 1.5, textAlign: 'center', marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  choiceBtnWrap: { position: 'relative' },
  choiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, borderWidth: 0.5,
    paddingHorizontal: 13, paddingVertical: 14,
  },
  choiceIndex: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  choiceIndexText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  choiceText:  { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '600', lineHeight: 18 },
  choiceArrow: { fontSize: 20, color: 'rgba(255,255,255,0.7)' },

  hintTooltip: {
    position: 'absolute', bottom: '110%', left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 10,
    padding: 10, zIndex: 30,
  },
  hintText: { fontSize: 13, color: '#fff', lineHeight: 18 },
  hintArrow: {
    position: 'absolute', bottom: -6, left: '50%', marginLeft: -6,
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(0,0,0,0.85)',
  },

  reactionWrap: {
    position: 'absolute', alignSelf: 'center',
    top: '38%', zIndex: 30, pointerEvents: 'none',
  },
  reactionEmoji: { fontSize: 64 },

  chapterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  chapterCard: {
    borderRadius: 16, borderWidth: 0.5,
    paddingHorizontal: 32, paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  chapterText: { fontSize: 20, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },

  titleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center', justifyContent: 'center', zIndex: 50,
    gap: 14,
  },
  titleRevealSub: {
    fontSize: 10, fontWeight: '800', color: colors.plumbob,
    letterSpacing: 3,
  },
  titleRevealTitle: {
    fontSize: 32, fontWeight: '900', color: '#FFFFFF',
    textAlign: 'center', letterSpacing: 1, paddingHorizontal: 32,
    lineHeight: 40,
  },
  titleLine: { width: 60, height: 2, borderRadius: 1 },

  overflowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', zIndex: 60,
    gap: 14,
  },
  overflowText: { color: '#fff', fontSize: 14, letterSpacing: 1.5, fontWeight: '800' },

  skipHint: {
    position: 'absolute', top: 14, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, zIndex: 30,
  },
  skipHintText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  freeformWrap: { marginTop: 6 },
  freeformTrigger: {
    paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  freeformTriggerText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  freeformCostBadge: { fontSize: 11, fontWeight: '800' },
  freeformLocked: {
    marginTop: 6, paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  freeformLockedText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: 'rgba(255,255,255,0.25)' },
  freeformLockedCost: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.25)' },
  freeformExpanded: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, borderWidth: 0.5,
    padding: 10, gap: 8,
  },
  freeformInput: {
    fontSize: 14, color: '#fff',
    minHeight: 44, maxHeight: 80,
    lineHeight: 20,
  },
  freeformActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  freeformCount: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  freeformCancel: {
    paddingHorizontal: 12, paddingVertical: 12,
  },
  freeformCancelText: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  freeformSend: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10,
  },
  freeformSendText: { fontSize: 12, fontWeight: '900', color: '#fff' },

  transitionBtnWrap: {
    position: 'absolute', bottom: 110, left: 0, right: 0, alignItems: 'center', zIndex: 10,
  },
  transitionBtn: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  transitionBtnText: {
    fontSize: 24, fontWeight: '800', color: 'rgba(255,255,255,0.60)',
  },
});
