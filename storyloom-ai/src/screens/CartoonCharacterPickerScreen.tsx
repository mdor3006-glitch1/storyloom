import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, useWindowDimensions, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoryStackParamList, WizardData } from '../navigation/MainStack';
import { colors } from '../theme/colors';
import LogoComponent from '../components/LogoComponent';

type Nav   = StackNavigationProp<StoryStackParamList, 'CartoonCharacterPicker'>;
type Route = RouteProp<StoryStackParamList, 'CartoonCharacterPicker'>;

const CATEGORIES: { label: string; chars: { emoji: string; name: string }[] }[] = [
  { label: 'FRUITS', chars: [
    { emoji: '🍓', name: 'Strawberry' }, { emoji: '🍌', name: 'Banana' }, { emoji: '🍊', name: 'Orange' },
    { emoji: '🍇', name: 'Grapes' }, { emoji: '🥝', name: 'Kiwi' }, { emoji: '🍋', name: 'Lemon' },
    { emoji: '🍑', name: 'Peach' }, { emoji: '🍒', name: 'Cherry' }, { emoji: '🍍', name: 'Pineapple' },
    { emoji: '🥭', name: 'Mango' }, { emoji: '🍎', name: 'Apple' }, { emoji: '🍐', name: 'Pear' },
    { emoji: '🫐', name: 'Blueberry' }, { emoji: '🍉', name: 'Watermelon' }, { emoji: '🍈', name: 'Melon' },
  ]},
  { label: 'VEGETABLES', chars: [
    { emoji: '🥦', name: 'Broccoli' }, { emoji: '🥕', name: 'Carrot' }, { emoji: '🌽', name: 'Corn' },
    { emoji: '🥑', name: 'Avocado' }, { emoji: '🍆', name: 'Eggplant' }, { emoji: '🥔', name: 'Potato' },
    { emoji: '🧅', name: 'Onion' }, { emoji: '🧄', name: 'Garlic' }, { emoji: '🌶️', name: 'Chili Pepper' },
    { emoji: '🥒', name: 'Cucumber' }, { emoji: '🍄', name: 'Mushroom' }, { emoji: '🥬', name: 'Lettuce' },
    { emoji: '🍅', name: 'Tomato' },
  ]},
  { label: 'FOOD & SNACKS', chars: [
    { emoji: '🍕', name: 'Pizza' }, { emoji: '🍔', name: 'Burger' }, { emoji: '🌮', name: 'Taco' },
    { emoji: '🍜', name: 'Noodles' }, { emoji: '🍣', name: 'Sushi' }, { emoji: '🧀', name: 'Cheese' },
    { emoji: '🥐', name: 'Croissant' }, { emoji: '🍩', name: 'Donut' }, { emoji: '🍦', name: 'Ice Cream' },
    { emoji: '🧁', name: 'Cupcake' }, { emoji: '🍫', name: 'Chocolate' }, { emoji: '🥨', name: 'Pretzel' },
    { emoji: '🍿', name: 'Popcorn' },
  ]},
  { label: 'KITCHEN ITEMS', chars: [
    { emoji: '🍳', name: 'Frying Pan' }, { emoji: '🔪', name: 'Knife' }, { emoji: '🥄', name: 'Spoon' },
    { emoji: '🫙', name: 'Jar' }, { emoji: '🥢', name: 'Chopsticks' }, { emoji: '🍶', name: 'Sake Bottle' },
    { emoji: '☕', name: 'Coffee Cup' }, { emoji: '🫖', name: 'Teapot' }, { emoji: '🧂', name: 'Salt Shaker' },
    { emoji: '🫕', name: 'Cooking Pot' },
  ]},
  { label: 'LIFESTYLE', chars: [
    { emoji: '🚬', name: 'Cigarette' }, { emoji: '💨', name: 'Vape' }, { emoji: '🪔', name: 'Candle' },
    { emoji: '🧨', name: 'Firecracker' }, { emoji: '💣', name: 'Bomb' },
  ]},
  { label: 'MUSIC', chars: [
    { emoji: '🎸', name: 'Guitar' }, { emoji: '🎹', name: 'Piano' }, { emoji: '🥁', name: 'Drum' },
    { emoji: '🎺', name: 'Trumpet' }, { emoji: '🎻', name: 'Violin' }, { emoji: '🪗', name: 'Accordion' },
    { emoji: '🎷', name: 'Saxophone' }, { emoji: '🪘', name: 'Bongo' },
  ]},
  { label: 'STATIONERY', chars: [
    { emoji: '✏️', name: 'Pencil' }, { emoji: '📎', name: 'Paperclip' }, { emoji: '📌', name: 'Pin' },
    { emoji: '🖊️', name: 'Pen' }, { emoji: '📏', name: 'Ruler' }, { emoji: '📐', name: 'Triangle' },
    { emoji: '🗂️', name: 'Folder' }, { emoji: '💼', name: 'Briefcase' },
  ]},
  { label: 'NATURE', chars: [
    { emoji: '🌵', name: 'Cactus' }, { emoji: '🌹', name: 'Rose' }, { emoji: '🌻', name: 'Sunflower' },
    { emoji: '💧', name: 'Water Drop' }, { emoji: '🔥', name: 'Fire' }, { emoji: '⚡', name: 'Lightning' },
    { emoji: '🌙', name: 'Moon' }, { emoji: '☁️', name: 'Cloud' }, { emoji: '❄️', name: 'Snowflake' },
  ]},
  { label: 'ANIMALS', chars: [
    { emoji: '🦁', name: 'Lion' }, { emoji: '🐻', name: 'Bear' }, { emoji: '🦊', name: 'Fox' },
    { emoji: '🐺', name: 'Wolf' }, { emoji: '🐸', name: 'Frog' }, { emoji: '🐧', name: 'Penguin' },
    { emoji: '🦄', name: 'Unicorn' }, { emoji: '🐲', name: 'Dragon' },
  ]},
];

const GENDERS = ['Male', 'Female', 'Non-binary'];

type Selected = { emoji: string; name: string; displayName: string; gender: string } | null;

export default function CartoonCharacterPickerScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const insets     = useSafeAreaInsets();
  const { width }  = useWindowDimensions();
  const wizardData = route.params;

  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch]     = useState('');
  const [main, setMain]         = useState<Selected>(null);
  const [secondary, setSecondary] = useState<Selected>(null);

  const allChars = useMemo(
    () => CATEGORIES.flatMap(c => c.chars),
    []
  );

  const displayChars = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return allChars.filter(c => c.name.toLowerCase().includes(q));
    }
    return CATEGORIES[activeCategory].chars;
  }, [search, activeCategory, allChars]);

  const CARD_SIZE = (width - 48 - 16) / 3;

  function selectChar(char: { emoji: string; name: string }, slot: 'main' | 'secondary') {
    const entry = { ...char, displayName: char.name, gender: 'Male' };
    if (slot === 'main') setMain(entry);
    else setSecondary(entry);
  }

  function updateSlot(slot: 'main' | 'secondary', field: 'displayName' | 'gender', value: string) {
    if (slot === 'main') setMain(prev => prev ? { ...prev, [field]: value } : null);
    else setSecondary(prev => prev ? { ...prev, [field]: value } : null);
  }

  function handleContinue() {
    if (!main || !secondary) { Alert.alert('', 'Please select both characters.'); return; }
    navigation.navigate('CharacterUpload', {
      ...wizardData,
      main_name:         main.displayName,
      secondary_name:    secondary.displayName,
      main_appearance:   `anthropomorphic ${main.name} character, ${main.gender.toLowerCase()}`,
      secondary_appearance: `anthropomorphic ${secondary.name} character, ${secondary.gender.toLowerCase()}`,
    } as any);
  }

  const canContinue = !!(main && secondary);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pick Your Characters</Text>
        <LogoComponent size="small" showWordmark={false} animated={false} />
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {CATEGORIES.map((cat, i) => (
          <TouchableOpacity
            key={cat.label}
            style={[styles.tab, activeCategory === i && !search && styles.tabActive]}
            onPress={() => { setActiveCategory(i); setSearch(''); }}
          >
            <Text style={[styles.tabText, activeCategory === i && !search && styles.tabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.search}
          placeholder="Search characters..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Character grid */}
      <FlatList
        data={displayChars}
        keyExtractor={c => c.name}
        numColumns={3}
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => {
          const isMain = main?.name === item.name;
          const isSec  = secondary?.name === item.name;
          return (
            <TouchableOpacity
              style={[
                styles.charCard,
                { width: CARD_SIZE, height: CARD_SIZE },
                isMain && styles.charCardMain,
                isSec  && styles.charCardSec,
              ]}
              onPress={() => {
                if (isMain) return;
                if (isSec) return;
                if (!main) selectChar(item, 'main');
                else if (!secondary) selectChar(item, 'secondary');
                else selectChar(item, 'main');
              }}
            >
              <Text style={[styles.charEmoji, { fontSize: CARD_SIZE * 0.42 }]}>{item.emoji}</Text>
              <Text style={styles.charName} numberOfLines={1}>{item.name}</Text>
              {isMain && <View style={styles.checkBadge}><Text style={styles.checkText}>✓ Main</Text></View>}
              {isSec  && <View style={[styles.checkBadge, styles.checkBadgeSec]}><Text style={styles.checkText}>✓ Sec</Text></View>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No characters found</Text>}
      />

      {/* Selection slots */}
      <View style={styles.slots}>
        {(['main', 'secondary'] as const).map(slot => {
          const sel = slot === 'main' ? main : secondary;
          return (
            <View key={slot} style={[styles.slot, sel && styles.slotFilled]}>
              {sel ? (
                <>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotEmoji}>{sel.emoji}</Text>
                    <View style={styles.slotMeta}>
                      <Text style={styles.slotRole}>{slot === 'main' ? 'MAIN' : 'SECONDARY'}</Text>
                      <TouchableOpacity onPress={() => slot === 'main' ? setMain(null) : setSecondary(null)}>
                        <Text style={styles.slotClear}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput
                    style={styles.slotNameInput}
                    value={sel.displayName}
                    onChangeText={v => updateSlot(slot, 'displayName', v)}
                    placeholder="Name..."
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.genderRow}>
                    {GENDERS.map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.genderPill, sel.gender === g && styles.genderPillActive]}
                        onPress={() => updateSlot(slot, 'gender', g)}
                      >
                        <Text style={[styles.genderText, sel.gender === g && styles.genderTextActive]}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.slotEmpty}>
                  <Text style={styles.slotEmptyIcon}>{slot === 'main' ? '👤' : '👥'}</Text>
                  <Text style={styles.slotEmptyLabel}>{slot === 'main' ? 'Main Character' : 'Secondary Character'}</Text>
                  <Text style={styles.slotEmptyHint}>Tap a character above</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Continue */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>{canContinue ? 'Continue →' : 'Select both characters'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.border },
  backText:    { fontSize: 18, color: colors.textSecondary },
  title:       { flex: 1, fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  tabs:        { maxHeight: 44, flexGrow: 0 },
  tabsContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.20)' },
  tabActive:   { backgroundColor: 'rgba(127,119,221,0.20)', borderColor: 'rgba(127,119,221,0.70)' },
  tabText:     { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  tabTextActive: { color: '#AFA9EC' },

  searchRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: 12 },
  searchIcon:  { fontSize: 14, marginRight: 6 },
  search:      { flex: 1, height: 40, color: colors.textPrimary, fontSize: 14 },
  clearSearch: { color: colors.textMuted, fontSize: 16, padding: 4 },

  grid:        { flex: 1, marginTop: 10 },
  gridContent: { paddingHorizontal: 16, gap: 8 },

  charCard:    { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center', gap: 4, margin: 2 },
  charCardMain: { borderColor: 'rgba(127,119,221,0.70)', backgroundColor: 'rgba(127,119,221,0.20)' },
  charCardSec:  { borderColor: 'rgba(127,119,221,0.50)', backgroundColor: 'rgba(127,119,221,0.12)' },
  charEmoji:    {},
  charName:     { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },
  checkBadge:   { position: 'absolute', top: 4, right: 4, backgroundColor: colors.plumbob, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 },
  checkBadgeSec: { backgroundColor: colors.plumbobDim },
  checkText:    { fontSize: 9, color: '#fff', fontWeight: '800' },
  emptyText:    { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },

  slots:       { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  slot:        { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 0.5, borderColor: colors.border, padding: 12, minHeight: 110 },
  slotFilled:  { borderColor: colors.plumbob },
  slotHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  slotEmoji:   { fontSize: 24 },
  slotMeta:    { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slotRole:    { fontSize: 9, fontWeight: '800', color: colors.plumbob, letterSpacing: 1 },
  slotClear:   { color: colors.textMuted, fontSize: 14, padding: 10 },
  slotNameInput: { backgroundColor: colors.bgSurface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.textPrimary, fontSize: 13, marginBottom: 8 },
  genderRow:   { flexDirection: 'row', gap: 4 },
  genderPill:  { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.20)' },
  genderPillActive: { backgroundColor: 'rgba(127,119,221,0.20)', borderColor: 'rgba(127,119,221,0.70)' },
  genderText:  { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  genderTextActive: { color: '#AFA9EC' },
  slotEmpty:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  slotEmptyIcon: { fontSize: 24, opacity: 0.4 },
  slotEmptyLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  slotEmptyHint: { fontSize: 10, color: colors.textMuted, opacity: 0.7 },

  footer:      { paddingHorizontal: 16, paddingTop: 8 },
  continueBtn: { backgroundColor: 'rgba(127,119,221,0.80)', borderRadius: 999, paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(127,119,221,0.90)', shadowColor: colors.plumbob, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  continueBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.07)', shadowOpacity: 0, borderColor: 'rgba(255,255,255,0.12)' },
  continueBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
