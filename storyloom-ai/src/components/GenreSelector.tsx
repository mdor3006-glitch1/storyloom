import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export const GENRES = [
  'Romance',
  'Thriller',
  'Fantasy',
  'Horror',
  'Drama',
  'Sci-Fi',
] as const;

export type Genre = typeof GENRES[number] | 'Surprise Me';

interface Props {
  selected: Genre | null;
  onSelect: (genre: Genre) => void;
}

export default function GenreSelector({ selected, onSelect }: Props) {
  const { t } = useTranslation();
  const options: Genre[] = [...GENRES, 'Surprise Me'];

  return (
    <View style={styles.grid}>
      {options.map((genre) => {
        const isSelected = selected === genre;
        const label = genre === 'Surprise Me' ? t('story_setup.surprise_me') : genre;
        return (
          <TouchableOpacity
            key={genre}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(genre)}
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
