import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  balance: number;
}

export default function CreditBalanceBadge({ balance }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.icon}>◆</Text>
      <Text style={styles.value}>{balance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.plumbobBorder,
  },
  icon: { fontSize: 11, color: colors.plumbob },
  value: { fontSize: 14, fontWeight: '700', color: colors.plumbob },
});
