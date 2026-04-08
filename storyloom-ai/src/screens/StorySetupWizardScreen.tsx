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
import { STORY_CREDIT_COSTS, StoryLength, hasEnoughCredits } from '../utils/creditHelpers';
import { StoryStackParamList, WizardData } from '../navigation/MainStack';

type Nav = StackNavigationProp<StoryStackParamList, 'StorySetupWizard'>;

// ── Step definitions ──────────────────────────────────────────

const STEPS = [
  {
    key: 'genre',
    titleKey: 'story_setup.step_genre',
    emoji: '🎭',
    options: ['Romance', 'Thriller', 'Fantasy', 'Horror', 'Drama', 'Sci-Fi', 'Surprise Me'],
  },
  {
    key: 'setting',
    titleKey: 'story_setup.step_setting',
    emoji: '🌍',
    options: ['City', 'Small Town', 'Fantasy World', 'Space', 'Historical', 'Surprise Me'],
  },
  {
    key: 'tone',
    titleKey: 'story_setup.step_tone',
    emoji: '🎨',
    options: ['Light & Fun', 'Dark & Intense', 'Romantic & Steamy', 'Mysterious', 'Surprise Me'],
  },
  {
    key: 'length',
    titleKey: 'story_setup.step_length',
    emoji: '📖',
    options: ['short', 'medium', 'long'] as const,
  },
  {
    key: 'art_style',
    titleKey: 'story_setup.step_art',
    emoji: '🖼️',
    options: ['Cinematic', 'Realistic', 'Anime', 'Illustrated', 'Comic Book', 'AI Decides'],
  },
] as const;

const TOTAL_STEPS = STEPS.length;

const LENGTH_META: Record<string, { label: string; scenes: string; credits: number; savings?: string }> = {
  short:  { label: 'Short',  scenes: '8 scenes',     credits: STORY_CREDIT_COSTS.short },
  medium: { label: 'Medium', scenes: '15 scenes',    credits: STORY_CREDIT_COSTS.medium },
  long:   { label: 'Long',   scenes: '25–40 scenes', credits: STORY_CREDIT_COSTS.long, savings: 'Best value' },
};

// ── Screen ────────────────────────────────────────────────────

export default function StorySetupWizardScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const balance = useCreditStore((s) => s.balance);

  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Partial<WizardData>>({});

  // Slide animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const currentStep = STEPS[step];
  const selected = selections[currentStep.key as keyof WizardData] ?? null;
  const canProceed = selected !== null;

  // ── Animate transition ──────────────────────────────────────
  function animateToStep(nextStep: number, direction: 1 | -1) {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction * -40, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(direction * 40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  function handleSelect(value: string) {
    setSelections((prev) => ({ ...prev, [currentStep.key]: value }));
  }

  function handleNext() {
    if (!canProceed) return;

    // Credit check on the length step
    if (currentStep.key === 'length') {
      const len = selected as StoryLength;
      if (!hasEnoughCredits(balance, len)) {
        Alert.alert(
          'Not enough credits',
          `A ${len} story costs ${STORY_CREDIT_COSTS[len]} credits. You have ${balance}.\n\nPurchase more credits to continue.`,
          [
            { text: 'Buy Credits', onPress: () => navigation.navigate('Tabs') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
    }

    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1, 1);
    } else {
      // All steps complete — go to CharacterUpload
      const wizard = selections as WizardData;
      navigation.navigate('CharacterUpload', wizard);
    }
  }

  function handleBack() {
    if (step === 0) {
      navigation.goBack();
    } else {
      animateToStep(step - 1, -1);
    }
  }

  // ── Render step content ─────────────────────────────────────
  function renderOptions() {
    if (currentStep.key === 'length') {
      return (
        <View style={styles.lengthGrid}>
          {(currentStep.options as readonly string[]).map((opt) => {
            const meta = LENGTH_META[opt];
            const isSelected = selected === opt;
            const affordable = hasEnoughCredits(balance, opt as StoryLength);
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.lengthCard,
                  isSelected && styles.lengthCardSelected,
                  !affordable && styles.lengthCardDisabled,
                ]}
                onPress={() => handleSelect(opt)}
                activeOpacity={0.75}
              >
                {meta.savings && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeText}>{meta.savings}</Text>
                  </View>
                )}
                <Text style={[styles.lengthLabel, isSelected && styles.lengthLabelSelected]}>
                  {meta.label}
                </Text>
                <Text style={[styles.lengthScenes, isSelected && styles.lengthScenesSelected]}>
                  {meta.scenes}
                </Text>
                <Text style={[styles.lengthCredits, isSelected && styles.lengthCreditsSelected]}>
                  {meta.credits} credits
                </Text>
                {!affordable && (
                  <Text style={styles.insufficientText}>Insufficient credits</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    return (
      <View style={styles.chipGrid}>
        {(currentStep.options as readonly string[]).map((opt) => {
          const isSelected = selected === opt;
          const isSurprise = opt === 'Surprise Me' || opt === 'AI Decides';
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                isSurprise && styles.chipSurprise,
                isSelected && isSurprise && styles.chipSurpriseSelected,
              ]}
              onPress={() => handleSelect(opt)}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
              ]}>
                {isSurprise ? t('story_setup.surprise_me') : opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ── UI ──────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
            />
          ))}
        </View>
        <Text style={styles.stepCounter}>{step + 1}/{TOTAL_STEPS}</Text>
      </View>

      {/* Animated step body */}
      <Animated.View
        style={[styles.body, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}
      >
        <ScrollView
          contentContainerStyle={[styles.bodyScroll, { minWidth: width - 48 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepEmoji}>{currentStep.emoji}</Text>
          <Text style={styles.stepTitle}>{t(currentStep.titleKey)}</Text>
          {renderOptions()}
        </ScrollView>
      </Animated.View>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>
            {step === TOTAL_STEPS - 1 ? 'Choose Characters →' : t('story_setup.next') + ' →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backText: {
    fontSize: 22,
    color: '#2E4057',
    width: 32,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DCE4EB',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#048A81',
  },
  dotDone: {
    backgroundColor: '#A8D5D1',
  },
  stepCounter: {
    width: 32,
    textAlign: 'right',
    fontSize: 13,
    color: '#A0AEBA',
  },

  // Animated body
  body: {
    flex: 1,
  },
  bodyScroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'flex-start',
  },
  stepEmoji: {
    fontSize: 40,
    marginBottom: 12,
    marginTop: 8,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2E4057',
    marginBottom: 28,
    lineHeight: 32,
  },

  // Generic chip grid (steps 1, 2, 3, 5)
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: '#F0F4F8',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: '#048A81',
    backgroundColor: '#E6F5F4',
  },
  chipSurprise: {
    borderStyle: 'dashed',
    borderColor: '#A0AEBA',
    borderWidth: 2,
    backgroundColor: '#FAFAFA',
  },
  chipSurpriseSelected: {
    borderColor: '#048A81',
    backgroundColor: '#E6F5F4',
    borderStyle: 'solid',
  },
  chipText: {
    fontSize: 15,
    color: '#2E4057',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#048A81',
    fontWeight: '700',
  },

  // Length cards (step 4)
  lengthGrid: {
    width: '100%',
    gap: 12,
  },
  lengthCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F0F4F8',
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 18,
    position: 'relative',
  },
  lengthCardSelected: {
    borderColor: '#048A81',
    backgroundColor: '#E6F5F4',
  },
  lengthCardDisabled: {
    opacity: 0.45,
  },
  savingsBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#048A81',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savingsBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  lengthLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E4057',
    marginBottom: 2,
  },
  lengthLabelSelected: { color: '#048A81' },
  lengthScenes: {
    fontSize: 13,
    color: '#6B7C93',
    marginBottom: 4,
  },
  lengthScenesSelected: { color: '#2E4057' },
  lengthCredits: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E4057',
  },
  lengthCreditsSelected: { color: '#048A81' },
  insufficientText: {
    fontSize: 12,
    color: '#E0533A',
    marginTop: 4,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  nextButton: {
    backgroundColor: '#048A81',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#C8D8DC',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
