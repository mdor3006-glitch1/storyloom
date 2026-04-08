import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const { t } = useTranslation();
  const progress = Math.min(current / total, 1);

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.label}>{t('scene.scene_of', { current, total })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 8 },
  track: {
    height: 4,
    backgroundColor: '#F0F4F8',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: { height: '100%', backgroundColor: '#048A81', borderRadius: 2 },
  label: { fontSize: 12, color: '#2E4057', textAlign: 'center' },
});
