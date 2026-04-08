import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  balance: number;
}

export default function CreditBalanceBadge({ balance }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{t('home.credits')}</Text>
      <Text style={styles.value}>{balance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  label: { fontSize: 13, color: '#2E4057' },
  value: { fontSize: 13, fontWeight: '700', color: '#048A81' },
});
