import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { useCreditStore } from '../store/creditStore';
import { useStoryStore } from '../store/storyStore';
import { STORY_CREDIT_COSTS, StoryLength, hasEnoughCredits } from '../utils/creditHelpers';
import { StoryStackParamList, WizardData } from '../navigation/MainStack';
import { colors } from '../theme/colors';
import Plumbob from '../components/Plumbob';
import api from '../services/api';

const BRAINROT_SUBTYPES = [
  { value: 'Size Swap World',    icon: '🌍', desc: 'Giants and tiny creatures coexist' },
  { value: 'Objects Come Alive', icon: '🤖', desc: 'Inanimate objects have jobs, feelings, drama' },
  { value: 'Role Reversal',      icon: '🔀', desc: 'Humans are pets, food has rights, objects run society' },
  { value: 'Reality Glitch',     icon: '🌀', desc: "Physics don't apply, anything can happen" },
  { value: 'Fever Dream',        icon: '👁️', desc: 'Unpredictable, surreal, dreamlike' },
  { value: 'Circus Reality',     icon: '🎪', desc: 'Every situation is maximally over-the-top' },
  { value: 'Impossible Hybrid',  icon: '🧬', desc: 'Characters are impossible combinations' },
];

type Nav = StackNavigationProp<StoryStackParamList, 'StorySetupWizard'>;

const STEPS = [
  {
    key: 'genre',
    label: 'GENRE',
    icon: '🎭',
    title: 'Pick your genre',
    subtitle: 'Every story starts with a spark',
    options: [
      { value: 'Romance',              icon: '💕', desc: 'Love, passion, heartbreak' },
      { value: 'Thriller',             icon: '🔪', desc: 'Suspense and danger' },
      { value: 'Fantasy',              icon: '🧙', desc: 'Magic and adventure' },
      { value: 'Horror',               icon: '👻', desc: 'Fear and the unknown' },
      { value: 'Drama',                icon: '🎬', desc: 'Emotional depth' },
      { value: 'Sci-Fi',               icon: '🚀', desc: 'The future awaits' },
      { value: 'Comedy',               icon: '😂', desc: 'Laughter and absurdity' },
      { value: 'Cartoon Characters',   icon: '🍌', desc: 'Anthropomorphic fun' },
      { value: 'Brainrot',             icon: '🤯', desc: 'Absurd, surreal, impossible to stop' },
      { value: 'Surprise Me',          icon: '🎲', desc: 'AI picks for you', surprise: true },
    ],
  },
  {
    key: 'setting',
    label: 'SETTING',
    icon: '🌍',
    title: 'Where does it happen?',
    subtitle: 'Set the stage for your story',
    options: [
      { value: 'City',              icon: '🏙️', desc: 'Urban jungle vibes' },
      { value: 'Small Town',        icon: '🏘️', desc: 'Everyone knows everyone' },
      { value: 'Fantasy World',     icon: '🏰', desc: 'Realms beyond reality' },
      { value: 'Space',             icon: '🌌', desc: 'Infinite cosmos' },
      { value: 'Historical',        icon: '⚔️', desc: 'A different era' },
      { value: 'Underwater',        icon: '🌊', desc: 'Beneath the surface' },
      { value: 'Haunted Mansion',   icon: '🕯️', desc: 'Secrets in the shadows' },
      { value: 'Post-Apocalyptic',  icon: '🌋', desc: 'After the end' },
      { value: 'Surprise Me',       icon: '🎲', desc: 'AI picks for you', surprise: true },
    ],
  },
  {
    key: 'tone',
    label: 'TONE',
    icon: '🎨',
    title: 'Set the mood',
    subtitle: 'How should the story feel?',
    options: [
      { value: 'Light & Fun',          icon: '☀️', desc: 'Breezy and cheerful' },
      { value: 'Dark & Intense',       icon: '🌑', desc: 'Heavy and gripping' },
      { value: 'Romantic & Steamy',    icon: '🔥', desc: 'Sensual and electric' },
      { value: 'Mysterious',           icon: '🔮', desc: 'Secrets and intrigue' },
      { value: 'Twisted',              icon: '🌀', desc: 'Unpredictable chaos' },
      { value: 'Cozy',                 icon: '☕', desc: 'Warm and comforting' },
      { value: 'Epic',                 icon: '⚡', desc: 'Grand and cinematic' },
      { value: 'Surprise Me',          icon: '🎲', desc: 'AI picks for you', surprise: true },
    ],
  },
  {
    key: 'length',
    label: 'LENGTH',
    icon: '📖',
    title: 'How long?',
    subtitle: 'Credits control story depth',
    options: [] as const, // handled separately
  },
  {
    key: 'art_style',
    label: 'ART STYLE',
    icon: '🖼️',
    title: 'Visual style',
    subtitle: 'How should your scenes look?',
    options: [
      { value: 'Cinematic',     icon: '🎥', desc: 'Hollywood-quality realism' },
      { value: 'Realistic',     icon: '📷', desc: 'True-to-life rendering' },
      { value: 'Anime',         icon: '⛩️', desc: 'Japanese animation style' },
      { value: 'Illustrated',   icon: '✏️', desc: 'Hand-drawn artistic' },
      { value: 'Comic Book',    icon: '💥', desc: 'Marvel / DC panels' },
      { value: 'Pixel Art',     icon: '🎮', desc: 'Retro game aesthetic' },
      { value: 'Oil Painting',  icon: '🎨', desc: 'Classical fine art' },
      { value: 'AI Decides',    icon: '🤖', desc: 'AI chooses the style', surprise: true },
    ],
  },
] as const;

const TOTAL_STEPS = STEPS.length;

// ── Mock-fill pools (used by 🎲 dev quick-play button) ──────────────────────
const MOCK_GENRES        = ['Romance', 'Thriller', 'Fantasy', 'Drama', 'Sci-Fi', 'Comedy', 'Horror'];
const MOCK_SETTINGS      = ['City', 'Small Town', 'Fantasy World', 'Space', 'Historical', 'Underwater', 'Haunted Mansion', 'Post-Apocalyptic'];
const MOCK_TONES         = ['Light & Fun', 'Dark & Intense', 'Romantic & Steamy', 'Mysterious', 'Twisted', 'Cozy', 'Epic'];
const MOCK_ART_STYLES    = ['Cinematic', 'Realistic', 'Anime', 'Illustrated', 'Comic Book', 'Pixel Art', 'Oil Painting'];
const MOCK_STORY_ELEMENTS = [
  'Hidden Identity', 'Second Chance Romance', 'Murder Mystery', 'Hidden Secret',
  'Personal Growth', 'Triumph Against Odds', 'Cinematic Feel', 'Maximum Drama',
  'Guaranteed Twist Ending', 'Unlikely Friendship',
];

const MOCK_MAIN_NAMES      = ['Alex', 'Riley', 'Jordan', 'Skylar', 'Casey', 'Morgan', 'Avery', 'Quinn'];
const MOCK_SECONDARY_NAMES = ['Luna', 'Nova', 'Kai', 'Ezra', 'Iris', 'Jamie', 'Sage', 'Phoenix'];

const MOCK_AGES        = ['Teen', 'Young Adult', 'Adult'];
const MOCK_GENDERS     = ['Male', 'Female'];
const MOCK_BODY_TYPES  = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular'];
const MOCK_SKIN_TONES  = ['Porcelain', 'Fair', 'Light', 'Medium', 'Tan', 'Brown', 'Dark Brown'];
const MOCK_HAIR_COLORS = ['Black', 'Brown', 'Blonde', 'Red', 'Auburn', 'Blue', 'Pink', 'Purple'];
const MOCK_HAIR_STYLES = ['Short', 'Long', 'Curly', 'Straight', 'Wavy', 'Ponytail', 'Braids'];
const MOCK_EYE_COLORS  = ['Brown', 'Blue', 'Green', 'Gray', 'Hazel', 'Amber'];
const MOCK_OUTFITS     = ['Casual', 'Formal', 'Athletic', 'Elegant', 'Streetwear', 'Fantasy Armor', 'Business Suit'];
const MOCK_FEATURES    = ['None', 'Glasses', 'Freckles', 'Tattoos', 'Beard', 'Dimples', 'Birthmark'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function mockAppearance(): string {
  const age      = pick(MOCK_AGES);
  const gender   = pick(MOCK_GENDERS).toLowerCase();
  const body     = pick(MOCK_BODY_TYPES).toLowerCase();
  const skin     = pick(MOCK_SKIN_TONES).toLowerCase();
  const hairCol  = pick(MOCK_HAIR_COLORS).toLowerCase();
  const hairSty  = pick(MOCK_HAIR_STYLES).toLowerCase();
  const eyes     = pick(MOCK_EYE_COLORS).toLowerCase();
  const outfit   = pick(MOCK_OUTFITS).toLowerCase();
  const feature  = pick(MOCK_FEATURES);
  const parts = [
    age,
    gender,
    `with ${body} build`,
    `${skin} skin`,
    `${hairSty} ${hairCol} hair`,
    `${eyes} eyes`,
    `wearing ${outfit} style clothing`,
  ];
  if (feature !== 'None') parts.push(`with ${feature.toLowerCase()}`);
  return parts.join(', ');
}

const LENGTH_META: Record<string, { label: string; scenes: string; credits: number; badge?: string; icon: string }> = {
  short:  { icon: '⚡', label: 'Short',  scenes: '~8 scenes',     credits: STORY_CREDIT_COSTS.short },
  medium: { icon: '📖', label: 'Medium', scenes: '~15 scenes',    credits: STORY_CREDIT_COSTS.medium },
  long:   { icon: '🏆', label: 'Long',   scenes: '25–40 scenes',  credits: STORY_CREDIT_COSTS.long, badge: 'BEST VALUE' },
};

export default function StorySetupWizardScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const balance = useCreditStore((s) => s.balance);
  const deductCredits = useCreditStore((s) => s.deductCredits);
  const setActiveStory = useStoryStore((s) => s.setActiveStory);

  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Partial<WizardData>>({});
  const [mocking, setMocking] = useState(false);

  async function handleMockPlay() {
    if (mocking) return;
    setMocking(true);
    try {
      const length: StoryLength = 'short';
      if (!hasEnoughCredits(balance, length)) {
        Alert.alert(
          'Not enough credits',
          `Mock story needs ${STORY_CREDIT_COSTS[length]} credits. You have ${balance}.`,
        );
        return;
      }

      const body = {
        genre:                pick(MOCK_GENRES),
        setting:              pick(MOCK_SETTINGS),
        tone:                 pick(MOCK_TONES),
        length,
        art_style:            pick(MOCK_ART_STYLES),
        story_elements:       JSON.stringify(pickN(MOCK_STORY_ELEMENTS, 3)),
        main_name:            pick(MOCK_MAIN_NAMES),
        main_traits:          JSON.stringify([]),
        main_appearance:      mockAppearance(),
        secondary_name:       pick(MOCK_SECONDARY_NAMES),
        secondary_traits:     JSON.stringify([]),
        secondary_appearance: mockAppearance(),
      };

      const { data } = await api.post('/stories', body);
      deductCredits(STORY_CREDIT_COSTS[length]);
      setActiveStory(data.story);
      navigation.navigate('LoadingScene', { storyId: data.story.id });
    } catch (err: any) {
      Alert.alert('Mock failed', err?.response?.data?.error ?? 'Could not create mock story.');
    } finally {
      setMocking(false);
    }
  }

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const currentStep = STEPS[step];
  const selected = selections[currentStep.key as keyof WizardData] ?? null;
  const needsSubtype = currentStep.key === 'genre' && selected === 'Brainrot' && !(selections as any).genre_subtype;
  const canProceed = selected !== null && !needsSubtype;

  function animateToStep(nextStep: number, direction: 1 | -1) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction * -36, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(direction * 36);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  function handleSelect(value: string) {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    setSelections((prev) => ({ ...prev, [currentStep.key]: value }));
  }

  function handleNext() {
    if (!canProceed) return;
    if (currentStep.key === 'length') {
      const len = selected as StoryLength;
      if (!hasEnoughCredits(balance, len)) {
        Alert.alert(
          'Not enough credits',
          `A ${len} story costs ${STORY_CREDIT_COSTS[len]} credits. You have ${balance}.`,
          [
            { text: 'Buy Credits', onPress: () => navigation.navigate('Tabs', { screen: 'Credits' } as any) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
    }
    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1, 1);
    } else {
      // After all wizard steps, go to Story Elements Picker
      navigation.navigate('StoryElementsPicker', selections as WizardData);
    }
  }

  function handleBack() {
    if (step === 0) navigation.goBack();
    else animateToStep(step - 1, -1);
  }

  function renderOptions() {
    if (currentStep.key === 'length') {
      return (
        <View style={styles.lengthGrid}>
          {(['short', 'medium', 'long'] as const).map((opt) => {
            const meta = LENGTH_META[opt];
            const isSelected = selected === opt;
            const affordable = hasEnoughCredits(balance, opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.lengthCard,
                  isSelected && styles.lengthCardSelected,
                  !affordable && styles.lengthCardDisabled,
                ]}
                onPress={() => handleSelect(opt)}
                activeOpacity={0.78}
              >
                {meta.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{meta.badge}</Text>
                  </View>
                )}
                <View style={styles.lengthTop}>
                  <Text style={styles.lengthIcon}>{meta.icon}</Text>
                  <Text style={[styles.lengthLabel, isSelected && styles.lengthLabelSelected]}>
                    {meta.label}
                  </Text>
                </View>
                <Text style={styles.lengthScenes}>{meta.scenes}</Text>
                <View style={styles.creditRow}>
                  <Text style={styles.creditDiamond}>◆</Text>
                  <Text style={[styles.lengthCredits, isSelected && styles.lengthCreditsSelected]}>
                    {meta.credits} credits
                  </Text>
                </View>
                {!affordable && (
                  <Text style={styles.insufficientText}>Need more credits</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    const opts = (currentStep as any).options as Array<{
      value: string; icon: string; desc: string; surprise?: boolean;
    }>;

    return (
      <View style={styles.chipGrid}>
        {opts.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <View key={opt.value}>
              <Animated.View style={{ transform: [{ scale: isSelected ? scaleAnim : new Animated.Value(1) }] }}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    isSelected && styles.chipSelected,
                    opt.surprise && styles.chipSurprise,
                    opt.value === 'Brainrot' && styles.chipBrainrot,
                  ]}
                  onPress={() => handleSelect(opt.value)}
                  activeOpacity={0.78}
                >
                  <Text style={styles.chipIcon}>{opt.icon}</Text>
                  <View style={styles.chipTextCol}>
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {opt.value}
                    </Text>
                    <Text style={styles.chipDesc}>{opt.desc}</Text>
                  </View>
                  {isSelected && <Text style={styles.chipCheck}>✓</Text>}
                </TouchableOpacity>
              </Animated.View>

              {/* Brainrot subtype picker — inline below the Brainrot option */}
              {opt.value === 'Brainrot' && isSelected && (
                <View style={styles.subtypeContainer}>
                  <Text style={styles.subtypeLabel}>Choose your reality 🤯</Text>
                  {BRAINROT_SUBTYPES.map((sub) => {
                    const subSel = (selections as any).genre_subtype === sub.value;
                    return (
                      <TouchableOpacity
                        key={sub.value}
                        style={[styles.chip, styles.subtypeChip, subSel && styles.chipSelected]}
                        onPress={() => setSelections((prev) => ({ ...prev, genre_subtype: sub.value }))}
                        activeOpacity={0.78}
                      >
                        <Text style={styles.chipIcon}>{sub.icon}</Text>
                        <View style={styles.chipTextCol}>
                          <Text style={[styles.chipText, subSel && styles.chipTextSelected]}>{sub.value}</Text>
                          <Text style={styles.chipDesc}>{sub.desc}</Text>
                        </View>
                        {subSel && <Text style={styles.chipCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Decorative corner plumbob */}
      <View style={styles.cornerDecor} pointerEvents="none">
        <Plumbob size={80} color={colors.plumbob + '22'} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>{currentStep.label}</Text>
          <View style={styles.progressRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step && styles.dotActive,
                  i < step && styles.dotDone,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.mockBtn, mocking && styles.mockBtnDisabled]}
            onPress={handleMockPlay}
            disabled={mocking}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Text style={styles.mockBtnIcon}>🎲</Text>
            <Text style={styles.mockBtnText}>{mocking ? '…' : 'MOCK'}</Text>
          </TouchableOpacity>
          <Text style={styles.stepCounter}>{step + 1}/{TOTAL_STEPS}</Text>
        </View>
      </View>

      {/* Animated body */}
      <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
          {/* Step header */}
          <View style={styles.stepHeader}>
            <Text style={styles.stepEmoji}>{currentStep.icon}</Text>
            <View>
              <Text style={styles.stepTitle}>{currentStep.title}</Text>
              <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
            </View>
          </View>

          {renderOptions()}
        </ScrollView>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          {canProceed ? (
            <View style={styles.nextBtnInner}>
              <Plumbob size={20} color="#ffffff" />
              <Text style={styles.nextButtonText}>
                {step === TOTAL_STEPS - 1 ? 'Choose Characters' : 'Next'}
              </Text>
              <Text style={styles.nextArrow}>→</Text>
            </View>
          ) : (
            <Text style={styles.nextButtonTextDisabled}>Select an option to continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  cornerDecor: {
    position: 'absolute',
    top: -20, right: -20,
    opacity: 0.4,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 16,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 16, color: colors.textSecondary },
  stepIndicator: { flex: 1, alignItems: 'center', gap: 8 },
  stepLabel: {
    fontSize: 10, fontWeight: '600',
    color: 'rgba(255,255,255,0.35)', letterSpacing: 0.7,
  },
  progressRow: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 7, height: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: { width: 22, backgroundColor: colors.plumbob },
  dotDone:   { backgroundColor: colors.plumbob },
  stepCounter: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(127,119,221,0.12)',
    borderWidth: 0.5, borderColor: colors.plumbobBorder,
  },
  mockBtnDisabled: { opacity: 0.5 },
  mockBtnIcon: { fontSize: 12 },
  mockBtnText: { fontSize: 10, fontWeight: '800', color: colors.plumbob, letterSpacing: 1 },

  body:       { flex: 1 },
  bodyScroll: { paddingHorizontal: 20, paddingBottom: 24 },

  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
    marginTop: 4,
  },
  stepEmoji: { fontSize: 36 },
  stepTitle: {
    fontSize: 22, fontWeight: '800',
    color: colors.textPrimary, letterSpacing: -0.3,
  },
  stepSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Option chips
  chipGrid: { gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  chipSelected: {
    borderColor: 'rgba(127,119,221,0.70)',
    backgroundColor: 'rgba(127,119,221,0.20)',
  },
  chipSurprise: {
    borderStyle: 'dashed',
    borderColor: colors.plumbobDim,
  },
  chipBrainrot: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255,107,107,0.08)',
  },
  subtypeContainer: {
    marginTop: 8,
    marginLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#FF6B6B',
    paddingLeft: 12,
    gap: 6,
  },
  subtypeLabel: {
    fontSize: 10, fontWeight: '800',
    color: '#FF6B6B', letterSpacing: 1.5,
    marginBottom: 4,
  },
  subtypeChip: {
    backgroundColor: 'rgba(255,107,107,0.06)',
    borderColor: 'rgba(255,107,107,0.25)',
  },
  chipIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  chipTextCol: { flex: 1 },
  chipText: { fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  chipTextSelected: { color: '#AFA9EC', fontWeight: '700' },
  chipDesc: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  chipCheck: { fontSize: 14, color: colors.plumbob, fontWeight: '800' },

  // Length cards
  lengthGrid: { gap: 10 },
  lengthCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.20)',
    padding: 18,
    position: 'relative',
  },
  lengthCardSelected: {
    borderColor: 'rgba(127,119,221,0.70)',
    backgroundColor: 'rgba(127,119,221,0.20)',
  },
  lengthCardDisabled: { opacity: 0.32 },
  lengthTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  lengthIcon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: colors.plumbob,
    borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  badgeText: { color: colors.bg, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  lengthLabel: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  lengthLabelSelected: { color: colors.plumbob },
  lengthScenes: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  creditDiamond: { fontSize: 9, color: colors.credit },
  lengthCredits: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  lengthCreditsSelected: { color: colors.plumbob },
  insufficientText: { fontSize: 12, color: colors.error, marginTop: 6 },

  footer: { paddingHorizontal: 20, paddingBottom: 44, paddingTop: 10 },
  nextButton: {
    backgroundColor: 'rgba(127,119,221,0.80)',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(127,119,221,0.90)',
    shadowColor: colors.plumbob,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText:         { color: '#ffffff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  nextButtonTextDisabled: { color: 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: '600' },
  nextArrow: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
});
