import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCredits } from '../hooks/useCredits';
import { CREDIT_PACKS } from '../utils/creditHelpers';
import api from '../services/api';
import { useCreditStore } from '../store/creditStore';

export default function CreditsScreen() {
  const { t } = useTranslation();
  const { balance, transactions, refresh, isPurchaseLoading } = useCredits();
  const setPurchaseLoading = useCreditStore((s) => s.setPurchaseLoading);

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePurchase(packId: string) {
    setPurchaseLoading(true);
    try {
      await api.post('/credits/purchase', { pack_id: packId });
      Alert.alert('Purchase initiated', 'Complete payment in the browser to receive your credits.');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? t('errors.generic');
      Alert.alert('Purchase failed', msg);
    } finally {
      setPurchaseLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Balance hero */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('credits.balance')}</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
        <Text style={styles.balanceSubtitle}>credits available</Text>
      </View>

      {/* Credit packs */}
      <Text style={styles.sectionTitle}>{t('credits.buy')}</Text>
      {CREDIT_PACKS.map((pack) => (
        <TouchableOpacity
          key={pack.id}
          style={styles.packRow}
          onPress={() => handlePurchase(pack.id)}
          disabled={isPurchaseLoading}
          activeOpacity={0.8}
        >
          <View style={styles.packInfo}>
            <Text style={styles.packLabel}>{pack.label}</Text>
            <Text style={styles.packCredits}>{pack.credits.toLocaleString()} credits</Text>
          </View>
          {isPurchaseLoading ? (
            <ActivityIndicator color="#048A81" />
          ) : (
            <Text style={styles.packPrice}>${pack.price.toFixed(2)}</Text>
          )}
        </TouchableOpacity>
      ))}

      {/* Transaction history */}
      {transactions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>History</Text>
          {transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txAmount, tx.amount > 0 ? styles.txPos : styles.txNeg]}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: '#2E4057',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceValue: { fontSize: 56, fontWeight: '800', color: '#fff', lineHeight: 64 },
  balanceSubtitle: { fontSize: 14, color: '#A8D5D1', marginTop: 4 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#6B7C93',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    shadowColor: '#2E4057',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  packInfo: { gap: 2 },
  packLabel: { fontSize: 16, fontWeight: '700', color: '#2E4057' },
  packCredits: { fontSize: 13, color: '#6B7C93' },
  packPrice: { fontSize: 18, fontWeight: '700', color: '#048A81' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  txLeft: { flex: 1 },
  txDesc: { fontSize: 14, color: '#2E4057', marginBottom: 2 },
  txDate: { fontSize: 12, color: '#A0AEBA' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txPos: { color: '#048A81' },
  txNeg: { color: '#E0533A' },
});
