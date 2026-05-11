import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { StoryStackParamList, WizardData } from '../navigation/MainStack';
import { STORY_CREDIT_COSTS } from '../utils/creditHelpers';
import api from '../services/api';
import { useStoryStore } from '../store/storyStore';
import { useCreditStore } from '../store/creditStore';
import { colors } from '../theme/colors';
import DiamondLoader from '../components/DiamondLoader';

type Nav   = StackNavigationProp<StoryStackParamList, 'CharacterUpload'>;
type Route = RouteProp<StoryStackParamList, 'CharacterUpload'>;

// ── Character builder option sets ───────────────────────────────────────────

const GENDERS = [
  { value: 'Male',   icon: '♂' },
  { value: 'Female', icon: '♀' },
  { value: 'Other',  icon: '⚧' },
];

const HAIR_COLORS = [
  { value: 'Black',      hex: '#1a1a1a' },
  { value: 'Dark Brown', hex: '#3d2b1f' },
  { value: 'Brown',      hex: '#7B4F2E' },
  { value: 'Blonde',     hex: '#F5D07A' },
  { value: 'Red',        hex: '#C0392B' },
  { value: 'Auburn',     hex: '#9B3622' },
  { value: 'Gray',       hex: '#9E9E9E' },
  { value: 'White',      hex: '#EEEEEE' },
  { value: 'Blue',       hex: '#1565C0' },
  { value: 'Pink',       hex: '#E91E8C' },
  { value: 'Purple',     hex: '#7B1FA2' },
  { value: 'Green',      hex: '#2E7D32' },
];

const HAIR_STYLES = [
  { value: 'Short',     icon: '✂️' },
  { value: 'Long',      icon: '💇' },
  { value: 'Curly',     icon: '🌀' },
  { value: 'Straight',  icon: '〰' },
  { value: 'Wavy',      icon: '〜' },
  { value: 'Bun',       icon: '🔵' },
  { value: 'Ponytail',  icon: '🎗' },
  { value: 'Bald',      icon: '🔘' },
  { value: 'Buzz Cut',  icon: '▪' },
  { value: 'Braids',    icon: '🌿' },
];

const EYE_COLORS = [
  { value: 'Brown',      hex: '#5D4037' },
  { value: 'Dark Brown', hex: '#3E2723' },
  { value: 'Blue',       hex: '#1565C0' },
  { value: 'Green',      hex: '#2E7D32' },
  { value: 'Gray',       hex: '#607D8B' },
  { value: 'Hazel',      hex: '#8D6E63' },
  { value: 'Amber',      hex: '#E65100' },
  { value: 'Black',      hex: '#212121' },
];

const SKIN_TONES = [
  { value: 'Porcelain',   hex: '#FDDBB4' },
  { value: 'Fair',        hex: '#F2C88F' },
  { value: 'Light',       hex: '#D4A574' },
  { value: 'Medium',      hex: '#B8864E' },
  { value: 'Tan',         hex: '#9C6B3C' },
  { value: 'Brown',       hex: '#7A4E2D' },
  { value: 'Dark Brown',  hex: '#5C3317' },
  { value: 'Deep',        hex: '#3E1F0D' },
];

const BODY_TYPES = [
  { value: 'Slim',       icon: '🤸' },
  { value: 'Athletic',   icon: '💪' },
  { value: 'Average',    icon: '🧍' },
  { value: 'Curvy',      icon: '🌸' },
  { value: 'Muscular',   icon: '🏋' },
  { value: 'Heavyset',   icon: '🐻' },
  { value: 'Petite',     icon: '🌺' },
  { value: 'Tall',       icon: '📏' },
];

const AGE_RANGES = [
  { value: 'Teen',        icon: '🎒', desc: '14–19' },
  { value: 'Young Adult', icon: '🎓', desc: '20–30' },
  { value: 'Adult',       icon: '💼', desc: '31–50' },
  { value: 'Senior',      icon: '🕰', desc: '51+' },
];

const OUTFIT_STYLES = [
  { value: 'Casual',          icon: '👕' },
  { value: 'Formal',          icon: '👔' },
  { value: 'Athletic',        icon: '🏃' },
  { value: 'Elegant',         icon: '👗' },
  { value: 'Streetwear',      icon: '🧢' },
  { value: 'Gothic',          icon: '🖤' },
  { value: 'Fantasy Armor',   icon: '⚔️' },
  { value: 'Military',        icon: '🎖' },
  { value: 'School Uniform',  icon: '📚' },
  { value: 'Business Suit',   icon: '🕴' },
];

const FEATURES = [
  { value: 'None',           icon: '✨' },
  { value: 'Facial scar',    icon: '⚔️' },
  { value: 'Glasses',        icon: '🤓' },
  { value: 'Beard',          icon: '🧔' },
  { value: 'Tattoos',        icon: '🎨' },
  { value: 'Freckles',       icon: '🌟' },
  { value: 'Nose piercing',  icon: '💎' },
  { value: 'Eye patch',      icon: '🏴‍☠️' },
  { value: 'Birthmark',      icon: '🦋' },
  { value: 'Dimples',        icon: '😊' },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface CharDraft {
  name:       string;
  gender:     string | null;
  hairColor:  string | null;
  hairStyle:  string | null;
  eyeColor:   string | null;
  skinTone:   string | null;
  bodyType:   string | null;
  ageRange:   string | null;
  outfit:     string | null;
  feature:    string | null;
}

const EMPTY_CHAR = (): CharDraft => ({
  name: '', gender: null, hairColor: null, hairStyle: null,
  eyeColor: null, skinTone: null, bodyType: null,
  ageRange: null, outfit: null, feature: null,
});

function buildAppearance(c: CharDraft): string {
  const parts: string[] = [];
  if (c.ageRange) parts.push(c.ageRange);
  if (c.gender)   parts.push(c.gender.toLowerCase());
  if (c.bodyType) parts.push(`with ${c.bodyType.toLowerCase()} build`);
  if (c.skinTone) parts.push(`${c.skinTone.toLowerCase()} skin`);
  if (c.hairStyle && c.hairColor) {
    parts.push(`${c.hairStyle.toLowerCase()} ${c.hairColor.toLowerCase()} hair`);
  } else if (c.hairColor) {
    parts.push(`${c.hairColor.toLowerCase()} hair`);
  }
  if (c.eyeColor) parts.push(`${c.eyeColor.toLowerCase()} eyes`);
  if (c.outfit)   parts.push(`wearing ${c.outfit.toLowerCase()} style clothing`);
  if (c.feature && c.feature !== 'None') parts.push(`with ${c.feature.toLowerCase()}`);
  return parts.join(', ');
}

function isCharComplete(c: CharDraft): boolean {
  return (
    c.name.trim().length > 0 &&
    !!c.gender && !!c.hairColor && !!c.hairStyle &&
    !!c.eyeColor && !!c.skinTone && !!c.bodyType &&
    !!c.ageRange && !!c.outfit && !!c.feature
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CharacterUploadScreen() {
  const navigation  = useNavigation<Nav>();
  const route       = useRoute<Route>();
  const wizard: WizardData = route.params;
  const setActiveStory = useStoryStore((s) => s.setActiveStory);
  const deductCredits  = useCreditStore((s) => s.deductCredits);

  const [activeTab, setActiveTab]   = useState<0 | 1>(0);
  const [chars, setChars]           = useState<[CharDraft, CharDraft]>([EMPTY_CHAR(), EMPTY_CHAR()]);
  const [submitting, setSubmitting] = useState(false);

  function patch(idx: 0 | 1, p: Partial<CharDraft>) {
    setChars((prev) => {
      const next: [CharDraft, CharDraft] = [{ ...prev[0] }, { ...prev[1] }];
      next[idx] = { ...next[idx], ...p };
      return next;
    });
  }

  const canSubmit =
    !submitting && isCharComplete(chars[0]) && isCharComplete(chars[1]);

  async function handleStartStory() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = {
        genre:              wizard.genre,
        genre_subtype:      wizard.genre_subtype ?? undefined,
        story_elements:     wizard.story_elements?.length ? JSON.stringify(wizard.story_elements) : undefined,
        setting:            wizard.setting,
        tone:               wizard.tone,
        length:             wizard.length,
        art_style:          wizard.art_style,
        main_name:          chars[0].name.trim(),
        main_traits:        JSON.stringify([]),
        main_appearance:    buildAppearance(chars[0]),
        secondary_name:     chars[1].name.trim(),
        secondary_traits:   JSON.stringify([]),
        secondary_appearance: buildAppearance(chars[1]),
      };

      const { data } = await api.post('/stories', body);

      deductCredits(STORY_CREDIT_COSTS[wizard.length as keyof typeof STORY_CREDIT_COSTS]);
      setActiveStory(data.story);
      navigation.navigate('LoadingScene', { storyId: data.story.id });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Create Characters</Text>
          <Text style={styles.headerSubtitle}>Design your cast</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(['Main Character', 'Secondary'] as const).map((label, idx) => {
          const done = isCharComplete(chars[idx as 0 | 1]);
          const active = activeTab === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(idx as 0 | 1)}
              activeOpacity={0.8}
            >
              {done && <Text style={styles.tabDoneIcon}>✓ </Text>}
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {idx === 0 ? '★ ' : '◆ '}{label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <CharacterBuilder
        char={chars[activeTab]}
        isMain={activeTab === 0}
        onChange={(p) => patch(activeTab, p)}
      />

      {/* Footer */}
      <View style={styles.footer}>
        {!canSubmit && (
          <Text style={styles.footerHint}>
            {!isCharComplete(chars[0])
              ? 'Complete Main Character first'
              : !isCharComplete(chars[1])
              ? 'Complete Secondary Character'
              : 'Almost ready!'}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.startButton, !canSubmit && styles.startButtonDisabled]}
          onPress={handleStartStory}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting
            ? <DiamondLoader size={22} animated showSparkles={false} />
            : <Text style={styles.startButtonText}>Begin Story →</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── CharacterBuilder sub-component ───────────────────────────────────────────

interface BuilderProps {
  char:     CharDraft;
  isMain:   boolean;
  onChange: (p: Partial<CharDraft>) => void;
}

function CharacterBuilder({ char, isMain, onChange }: BuilderProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.builderScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Name */}
      <Section icon="🏷" title="Character Name">
        <TextInput
          style={styles.nameInput}
          placeholder={isMain ? 'Enter main character name…' : 'Enter secondary character name…'}
          placeholderTextColor={colors.textMuted}
          value={char.name}
          onChangeText={(v) => onChange({ name: v.slice(0, 20) })}
          maxLength={20}
          returnKeyType="done"
        />
        <Text style={styles.nameCounter}>{char.name.length}/20</Text>
      </Section>

      {/* Age Range */}
      <Section icon="🗓" title="Age Range">
        <View style={styles.pillRow}>
          {AGE_RANGES.map((opt) => (
            <Pill
              key={opt.value}
              icon={opt.icon}
              label={opt.value}
              sub={opt.desc}
              selected={char.ageRange === opt.value}
              onPress={() => onChange({ ageRange: opt.value })}
            />
          ))}
        </View>
      </Section>

      {/* Gender */}
      <Section icon="⚧" title="Gender">
        <View style={styles.pillRow}>
          {GENDERS.map((opt) => (
            <Pill
              key={opt.value}
              icon={opt.icon}
              label={opt.value}
              selected={char.gender === opt.value}
              onPress={() => onChange({ gender: opt.value })}
            />
          ))}
        </View>
      </Section>

      {/* Body Type */}
      <Section icon="🏃" title="Body Type">
        <View style={styles.pillGrid}>
          {BODY_TYPES.map((opt) => (
            <Pill
              key={opt.value}
              icon={opt.icon}
              label={opt.value}
              selected={char.bodyType === opt.value}
              onPress={() => onChange({ bodyType: opt.value })}
              compact
            />
          ))}
        </View>
      </Section>

      {/* Skin Tone */}
      <Section icon="🖐" title="Skin Tone">
        <View style={styles.swatchRow}>
          {SKIN_TONES.map((opt) => (
            <ColorSwatch
              key={opt.value}
              hex={opt.hex}
              label={opt.value}
              selected={char.skinTone === opt.value}
              onPress={() => onChange({ skinTone: opt.value })}
            />
          ))}
        </View>
      </Section>

      {/* Hair Color */}
      <Section icon="💈" title="Hair Color">
        <View style={styles.swatchRow}>
          {HAIR_COLORS.map((opt) => (
            <ColorSwatch
              key={opt.value}
              hex={opt.hex}
              label={opt.value}
              selected={char.hairColor === opt.value}
              onPress={() => onChange({ hairColor: opt.value })}
            />
          ))}
        </View>
      </Section>

      {/* Hair Style */}
      <Section icon="✂️" title="Hair Style">
        <View style={styles.pillGrid}>
          {HAIR_STYLES.map((opt) => (
            <Pill
              key={opt.value}
              icon={opt.icon}
              label={opt.value}
              selected={char.hairStyle === opt.value}
              onPress={() => onChange({ hairStyle: opt.value })}
              compact
            />
          ))}
        </View>
      </Section>

      {/* Eye Color */}
      <Section icon="👁" title="Eye Color">
        <View style={styles.swatchRow}>
          {EYE_COLORS.map((opt) => (
            <ColorSwatch
              key={opt.value}
              hex={opt.hex}
              label={opt.value}
              selected={char.eyeColor === opt.value}
              onPress={() => onChange({ eyeColor: opt.value })}
            />
          ))}
        </View>
      </Section>

      {/* Outfit Style */}
      <Section icon="👗" title="Outfit Style">
        <View style={styles.pillGrid}>
          {OUTFIT_STYLES.map((opt) => (
            <Pill
              key={opt.value}
              icon={opt.icon}
              label={opt.value}
              selected={char.outfit === opt.value}
              onPress={() => onChange({ outfit: opt.value })}
              compact
            />
          ))}
        </View>
      </Section>

      {/* Distinguishing Feature */}
      <Section icon="⭐" title="Distinguishing Feature">
        <View style={styles.pillGrid}>
          {FEATURES.map((opt) => (
            <Pill
              key={opt.value}
              icon={opt.icon}
              label={opt.value}
              selected={char.feature === opt.value}
              onPress={() => onChange({ feature: opt.value })}
              compact
            />
          ))}
        </View>
      </Section>

      {/* Appearance preview */}
      {isCharComplete({ ...char, feature: char.feature ?? 'None' }) && (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>CHARACTER APPEARANCE</Text>
          <Text style={styles.previewText}>{buildAppearance({ ...char, feature: char.feature ?? 'None' })}</Text>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ── Reusable Section ─────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Pill button ──────────────────────────────────────────────────────────────

interface PillProps {
  icon:     string;
  label:    string;
  sub?:     string;
  selected: boolean;
  onPress:  () => void;
  compact?: boolean;
}

function Pill({ icon, label, sub, selected, onPress, compact }: PillProps) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillSelected, compact && styles.pillCompact]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.pillIcon, compact && styles.pillIconCompact]}>{icon}</Text>
      <View>
        <Text style={[styles.pillLabel, selected && styles.pillLabelSelected, compact && styles.pillLabelCompact]}>
          {label}
        </Text>
        {sub && !compact && (
          <Text style={styles.pillSub}>{sub}</Text>
        )}
      </View>
      {selected && !compact && <Text style={styles.pillCheck}>✓</Text>}
    </TouchableOpacity>
  );
}

// ── Color swatch ─────────────────────────────────────────────────────────────

interface SwatchProps {
  hex:      string;
  label:    string;
  selected: boolean;
  onPress:  () => void;
}

function ColorSwatch({ hex, label, selected, onPress }: SwatchProps) {
  const isLight = hex === '#EEEEEE' || hex === '#F5F5F5' || hex === '#FDDBB4' || hex === '#F2C88F' || hex === '#F5D07A';
  return (
    <TouchableOpacity
      style={[styles.swatch, selected && styles.swatchSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View
        style={[
          styles.swatchCircle,
          { backgroundColor: hex },
          isLight && styles.swatchCircleLight,
          selected && styles.swatchCircleSelected,
        ]}
      >
        {selected && (
          <Text style={[styles.swatchCheck, isLight && styles.swatchCheckDark]}>✓</Text>
        )}
      </View>
      <Text style={[styles.swatchLabel, selected && styles.swatchLabelSelected]} numberOfLines={1}>
        {label.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backText:      { fontSize: 22, color: colors.textSecondary, width: 28, marginTop: 2 },
  headerCenter:  { flex: 1, alignItems: 'center' },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.20)',
    gap: 4,
  },
  tabActive: {
    backgroundColor: 'rgba(127,119,221,0.20)',
    borderColor: 'rgba(127,119,221,0.70)',
  },
  tabDoneIcon: { fontSize: 10, color: '#AFA9EC', fontWeight: '800' },
  tabText:     { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  tabTextActive: { color: '#AFA9EC' },

  // Builder scroll
  builderScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  sectionIcon:  { fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 },

  // Name input
  nameInput: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
  },
  nameCounter: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: 4 },

  // Pill layouts
  pillRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  pillSelected: {
    backgroundColor: 'rgba(127,119,221,0.20)',
    borderColor: 'rgba(127,119,221,0.70)',
  },
  pillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  pillIcon:        { fontSize: 16 },
  pillIconCompact: { fontSize: 13 },
  pillLabel: {
    fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600',
  },
  pillLabelSelected: { color: '#AFA9EC', fontWeight: '700' },
  pillLabelCompact:  { fontSize: 12 },
  pillSub:   { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  pillCheck: { fontSize: 11, color: colors.plumbob, marginLeft: 'auto', fontWeight: '800' },

  // Swatch row
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    alignItems: 'center',
    gap: 4,
    width: 52,
  },
  swatchSelected: {},
  swatchCircle: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchCircleLight:    { borderColor: colors.border },
  swatchCircleSelected: { borderColor: colors.plumbob, borderWidth: 3 },
  swatchCheck:      { fontSize: 14, color: '#fff', fontWeight: '800' },
  swatchCheckDark:  { color: '#333' },
  swatchLabel: {
    fontSize: 9, color: colors.textMuted,
    textAlign: 'center', fontWeight: '600',
  },
  swatchLabelSelected: { color: colors.plumbob },

  // Appearance preview
  previewCard: {
    backgroundColor: 'rgba(127,119,221,0.12)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.plumbobBorder,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 9, fontWeight: '800', color: colors.plumbob,
    letterSpacing: 2, marginBottom: 6,
  },
  previewText: {
    fontSize: 13, color: colors.textSecondary,
    lineHeight: 20, fontStyle: 'italic',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 44,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: 8,
  },
  footerHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  startButton: {
    backgroundColor: 'rgba(127,119,221,0.80)',
    borderRadius: 999, paddingVertical: 17, alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(127,119,221,0.90)',
    shadowColor: colors.plumbob,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  startButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
});
