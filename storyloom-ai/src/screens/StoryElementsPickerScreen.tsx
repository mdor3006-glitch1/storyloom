import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoryStackParamList, WizardData } from '../navigation/MainStack';
import { colors } from '../theme/colors';

type Nav   = StackNavigationProp<StoryStackParamList, 'StoryElementsPicker'>;
type Route = RouteProp<StoryStackParamList, 'StoryElementsPicker'>;

const MAX_ELEMENTS = 5;

interface Element {
  emoji: string;
  title: string;
  desc: string;
}

const CATEGORIES: { label: string; elements: Element[] }[] = [
  { label: 'RELATIONSHIP DRAMA', elements: [
    { emoji: '💔', title: 'Betrayal & Cheating',    desc: 'Trust shattered, hearts broken' },
    { emoji: '💍', title: 'Secret Engagement',       desc: 'Hidden promises and rings' },
    { emoji: '👶', title: 'Surprise Pregnancy',      desc: 'A new life changes everything' },
    { emoji: '💔', title: 'Painful Divorce',         desc: 'When love falls apart' },
    { emoji: '🔄', title: 'Second Chance Romance',   desc: 'Old flames reignited' },
    { emoji: '👨‍👩‍👧', title: 'Family Conflict',      desc: 'Blood ties that bind and break' },
    { emoji: '🤫', title: 'Hidden Identity',         desc: 'Someone is not who they seem' },
  ]},
  { label: 'ACTION & CONFLICT', elements: [
    { emoji: '👊', title: 'Fight & Reconciliation',  desc: 'War between hearts' },
    { emoji: '🏃', title: 'Chase & Escape',          desc: 'Running for survival' },
    { emoji: '🗡️', title: 'Revenge Plot',           desc: 'Served cold and calculated' },
    { emoji: '💰', title: 'Inheritance War',         desc: 'Family money tears them apart' },
    { emoji: '🕵️', title: 'Spy & Betrayal',         desc: 'Nobody can be trusted' },
  ]},
  { label: 'MYSTERY & THRILLER', elements: [
    { emoji: '🔍', title: 'Murder Mystery',          desc: 'Someone did something unforgivable' },
    { emoji: '🗝️', title: 'Hidden Secret',           desc: 'The truth will destroy everything' },
    { emoji: '👻', title: 'Supernatural Element',    desc: 'Beyond natural explanation' },
    { emoji: '📱', title: 'Blackmail',               desc: 'Leverage and threats' },
    { emoji: '🎭', title: 'Double Life',             desc: 'Two faces, one person' },
  ]},
  { label: 'COMEDY & ABSURD', elements: [
    { emoji: '😂', title: 'Ridiculous Misunderstanding', desc: 'Everything goes hilariously wrong' },
    { emoji: '🤦', title: 'Comedy of Errors',        desc: 'One mistake leads to another' },
    { emoji: '👀', title: 'Caught in the Act',       desc: 'At exactly the worst moment' },
    { emoji: '🎪', title: 'Absurd Situation',        desc: 'This should not be happening' },
  ]},
  { label: 'EMOTIONAL', elements: [
    { emoji: '😢', title: 'Heartbreaking Loss',      desc: 'Grief that changes everything' },
    { emoji: '🌱', title: 'Personal Growth',         desc: 'Becoming who you were meant to be' },
    { emoji: '🤝', title: 'Unlikely Friendship',     desc: 'Opposites that complete each other' },
    { emoji: '🏆', title: 'Triumph Against Odds',    desc: 'Against all expectations' },
  ]},
  { label: 'POWER & SIZE', elements: [
    { emoji: '🌍', title: 'Giant World',             desc: 'Scale changes everything' },
    { emoji: '🔄', title: 'Size Swap',               desc: 'Perspectives flipped entirely' },
    { emoji: '🛒', title: 'Pet/Toy Dynamic',         desc: 'Power imbalance at its purest' },
    { emoji: '🔒', title: 'Captivity',               desc: 'Trapped with no easy escape' },
    { emoji: '👑', title: 'Total Power Imbalance',   desc: 'One controls everything' },
  ]},
  { label: 'WILD CARDS', elements: [
    { emoji: '🎰', title: 'Guaranteed Twist Ending', desc: 'Nothing is what it seemed' },
    { emoji: '⚡', title: 'Fast Pace',              desc: 'Non-stop momentum' },
    { emoji: '🌶️', title: 'Steamy Romance (18+)',   desc: 'Intense and passionate' },
    { emoji: '😱', title: 'Maximum Drama',           desc: 'Every scene is explosive' },
    { emoji: '🎬', title: 'Cinematic Feel',          desc: 'Feels like a blockbuster film' },
  ]},
];

export default function StoryElementsPickerScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const insets     = useSafeAreaInsets();
  const wizardData = route.params as WizardData;

  const [selected, setSelected] = useState<string[]>([]);

  function toggle(title: string) {
    if (selected.includes(title)) {
      setSelected(prev => prev.filter(t => t !== title));
    } else if (selected.length >= MAX_ELEMENTS) {
      Alert.alert('Max 5 elements', 'Remove one before adding another.');
    } else {
      setSelected(prev => [...prev, title]);
    }
  }

  function proceed(elements: string[]) {
    const data: WizardData = { ...wizardData, story_elements: elements };
    if (wizardData.genre === 'Cartoon Characters') {
      navigation.navigate('CartoonCharacterPicker', data);
    } else {
      navigation.navigate('CharacterUpload', data);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Shape Your Story ✨</Text>
          <Text style={styles.subtitle}>Pick up to 5 elements (optional)</Text>
        </View>
        <TouchableOpacity onPress={() => proceed([])} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip →</Text>
        </TouchableOpacity>
      </View>

      {/* Counter */}
      <View style={styles.counterRow}>
        <Text style={[styles.counter, selected.length > 0 && styles.counterActive]}>
          Selected: {selected.length} / {MAX_ELEMENTS}
        </Text>
        {selected.length > 0 && (
          <TouchableOpacity onPress={() => setSelected([])}>
            <Text style={styles.clearAll}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Elements */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORIES.map(cat => (
          <View key={cat.label} style={styles.section}>
            <Text style={styles.sectionLabel}>{cat.label}</Text>
            {cat.elements.map(el => {
              const active = selected.includes(el.title);
              return (
                <TouchableOpacity
                  key={el.title}
                  style={[styles.card, active && styles.cardActive]}
                  onPress={() => toggle(el.title)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cardEmoji}>{el.emoji}</Text>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{el.title}</Text>
                    <Text style={styles.cardDesc}>{el.desc}</Text>
                  </View>
                  {active && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.goBtn}
          onPress={() => proceed(selected)}
          activeOpacity={0.85}
        >
          <Text style={styles.goBtnText}>
            {selected.length === 0 ? "Let's Go →" : `Add ${selected.length} element${selected.length > 1 ? 's' : ''} →`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  backText:    { fontSize: 18, color: colors.textSecondary },
  headerCenter:{ flex: 1 },
  title:       { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
  subtitle:    { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  skipBtn:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  skipText:    { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  counterRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  counter:     { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  counterActive: { color: colors.plumbob, fontWeight: '800' },
  clearAll:    { fontSize: 12, color: colors.error, fontWeight: '600' },

  scroll:      { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  section:     { marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: colors.plumbob, letterSpacing: 2, marginBottom: 10 },

  card:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
  cardActive:  { borderColor: colors.plumbob, backgroundColor: colors.plumbobGlow },
  cardEmoji:   { fontSize: 24, width: 32, textAlign: 'center' },
  cardText:    { flex: 1 },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  cardTitleActive: { color: colors.textPrimary },
  cardDesc:    { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  checkmark:   { fontSize: 16, color: colors.plumbob, fontWeight: '900' },

  footer:      { paddingHorizontal: 16, paddingTop: 10 },
  goBtn:       { backgroundColor: colors.plumbob, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: colors.plumbob, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  goBtnText:   { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
});
