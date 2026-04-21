import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const { t } = useTranslation();
  const progress = Math.min(current / Math.max(total, 1), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('scene.scene_of', { current, total })}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4, paddingVertical: 6 },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  track: {
    height: 3,
    backgroundColor: colors.bgCard,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.plumbob, borderRadius: 2 },
});
