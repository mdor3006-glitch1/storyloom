import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export const ART_STYLES = [
  'Cinematic',
  'Realistic',
  'Anime',
  'Illustrated',
  'Comic Book',
] as const;

export type ArtStyle = typeof ART_STYLES[number] | 'AI Decides';

interface Props {
  selected: ArtStyle | null;
  onSelect: (style: ArtStyle) => void;
}

export default function ArtStyleSelector({ selected, onSelect }: Props) {
  const { t } = useTranslation();
  const options: ArtStyle[] = [...ART_STYLES, 'AI Decides'];

  return (
    <View style={styles.grid}>
      {options.map((style) => {
        const isSelected = selected === style;
        const label = style === 'AI Decides' ? t('story_setup.surprise_me') : style;
        return (
          <TouchableOpacity
            key={style}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(style)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F0F4F8',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: { borderColor: '#048A81', backgroundColor: '#E6F5F4' },
  chipText: { fontSize: 15, color: '#2E4057' },
  chipTextSelected: { color: '#048A81', fontWeight: '600' },
});
