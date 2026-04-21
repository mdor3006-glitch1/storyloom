import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCredits } from '../hooks/useCredits';
import { CREDIT_PACKS } from '../utils/creditHelpers';
import api from '../services/api';
import { useCreditStore } from '../store/creditStore';
import { colors } from '../theme/colors';
import DiamondLoader from '../components/DiamondLoader';
import Plumbob from '../components/Plumbob';

const PACK_META: Record<string, { icon: string; color: string; tagline: string }> = {
  starter: { icon: '🌱', color: '#6B7280',           tagline: 'Try it out'           },
  basic:   { icon: '⚡', color: '#3B82F6',           tagline: 'Good for a few stories' },
  popular: { icon: '◆', color: colors.plumbob,       tagline: 'Most popular choice'  },
  value:   { icon: '💎', color: colors.teal,          tagline: 'Best bang for buck'   },
  mega:    { icon: '🏆', color: '#FF8A65',            tagline: 'The serious player'   },
};

export default function CreditsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { balance, transactions, refresh, isPurchaseLoading } = useCredits();
  const setPurchaseLoading = useCreditStore((s) => s.setPurchaseLoading);
  const [isPlus, setIsPlus] = useState(false);

  useEffect(() => {
    refresh();
    api.get('/subscriptions/status').then(({ data }) => setIsPlus(data.is_plus)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubscribe() {
    try {
      const { data } = await api.post('/subscriptions/subscribe');
      Alert.alert('StoryLoom Plus', 'Opening checkout...', [
        { text: 'OK' },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Something went wrong.');
    }
  }

  async function handlePurchase(packId: string) {
    setPurchaseLoading(true);
    try {
      await api.post('/credits/purchase', { pack_id: packId });
      Alert.alert('Purchase initiated', 'Complete payment in the browser to receive your credits.');
    } catch (err: any) {
      Alert.alert('Purchase failed', err?.response?.data?.error ?? t('errors.generic'));
    } finally {
      setPurchaseLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Plumbob size={28} color={colors.plumbob} />
        <Text style={styles.headerTitle}>Credits</Text>
      </View>

      {/* Balance hero card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceGlow} />
        <Plumbob size={52} animated />
        <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
        <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
        <Text style={styles.balanceSubtitle}>credits available · use them on any story</Text>
        <View style={styles.balanceMeta}>
          <Text style={styles.balanceMetaItem}>Short 50◆</Text>
          <View style={styles.balanceDot} />
          <Text style={styles.balanceMetaItem}>Medium 100◆</Text>
          <View style={styles.balanceDot} />
          <Text style={styles.balanceMetaItem}>Long 175◆</Text>
        </View>
      </View>

      {/* Credit packs */}
      <Text style={styles.sectionTitle}>◆  BUY CREDITS</Text>
      {CREDIT_PACKS.map((pack) => {
        const meta = PACK_META[pack.id] ?? { icon: '◆', color: colors.plumbob, tagline: '' };
        const isPopular = pack.id === 'popular';
        return (
          <TouchableOpacity
            key={pack.id}
            style={[styles.packCard, isPopular && styles.packCardHighlighted]}
            onPress={() => handlePurchase(pack.id)}
            disabled={isPurchaseLoading}
            activeOpacity={0.82}
          >
            {isPopular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>⭐ MOST POPULAR</Text>
              </View>
            )}
            <View style={[styles.packIconBox, { backgroundColor: meta.color + '22' }]}>
              <Text style={styles.packIconText}>{meta.icon}</Text>
            </View>
            <View style={styles.packInfo}>
              <Text style={styles.packLabel}>{pack.label}</Text>
              <Text style={styles.packCredits}>{pack.credits.toLocaleString()} credits</Text>
              <Text style={styles.packTagline}>{meta.tagline}</Text>
            </View>
            {isPurchaseLoading ? (
              <DiamondLoader size={22} animated showSparkles={false} />
            ) : (
              <View style={[styles.priceTag, { borderColor: meta.color + '88' }]}>
                <Text style={[styles.priceText, { color: meta.color }]}>${pack.price.toFixed(2)}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* StoryLoom Plus */}
      <View style={styles.plusCard}>
        <View style={styles.plusHeader}>
          <Text style={styles.plusIcon}>◆</Text>
          <View style={styles.plusTitles}>
            <Text style={styles.plusTitle}>StoryLoom Plus</Text>
            {isPlus && <View style={styles.plusActiveBadge}><Text style={styles.plusActiveTxt}>Active</Text></View>}
          </View>
          <Text style={styles.plusPrice}>$5/mo</Text>
        </View>
        <View style={styles.plusBenefits}>
          {[
            'Unlimited active stories',
            'Stories saved 30 days',
            '100 bonus credits every month',
            'Exclusive genres: Dark Romance, Cosmic Horror…',
            'Gold ◆ badge next to your name',
            'Priority AI generation queue',
          ].map((b, i) => (
            <View key={i} style={styles.plusBenefitRow}>
              <Text style={styles.plusCheck}>✓</Text>
              <Text style={styles.plusBenefit}>{b}</Text>
            </View>
          ))}
        </View>
        {!isPlus && (
          <TouchableOpacity style={styles.plusBtn} onPress={handleSubscribe} activeOpacity={0.88}>
            <Text style={styles.plusBtnText}>Subscribe Now →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>📋  HISTORY</Text>
          {transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txDot, { backgroundColor: tx.amount > 0 ? colors.plumbob : colors.error }]} />
              <View style={styles.txLeft}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txAmount, tx.amount > 0 ? styles.txPos : styles.txNeg]}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}◆
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingBottom: 18,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },

  // Balance hero
  balanceCard: {
    marginHorizontal: 18,
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: colors.plumbobBorder,
    overflow: 'hidden',
    gap: 6,
  },
  balanceGlow: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.plumbobGlow,
    top: -60,
  },
  balanceLabel: {
    fontSize: 10, fontWeight: '800', color: colors.textMuted,
    letterSpacing: 2.5,
  },
  balanceValue: {
    fontSize: 60, fontWeight: '900',
    color: colors.plumbob, lineHeight: 68, letterSpacing: -2,
  },
  balanceSubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  balanceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  balanceMetaItem: { fontSize: 11, color: colors.plumbob, fontWeight: '600' },
  balanceDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },

  sectionTitle: {
    fontSize: 9, fontWeight: '800', color: colors.plumbob,
    letterSpacing: 2.5, marginBottom: 12,
    paddingHorizontal: 18,
  },

  // Pack card
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    marginHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    overflow: 'hidden',
  },
  packCardHighlighted: {
    borderColor: colors.plumbobBorder,
    backgroundColor: colors.plumbobGlow,
  },
  popularBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.plumbob,
    paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularBadgeText: { fontSize: 8, fontWeight: '800', color: colors.bg, letterSpacing: 0.6 },
  packIconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  packIconText: { fontSize: 22 },
  packInfo: { flex: 1, gap: 1 },
  packLabel: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  packCredits: { fontSize: 13, color: colors.textSecondary },
  packTagline: { fontSize: 11, color: colors.textMuted },
  priceTag: {
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  priceText: { fontSize: 15, fontWeight: '900' },

  // Transactions
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  txDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  txLeft: { flex: 1 },
  txDesc: { fontSize: 14, color: colors.textPrimary, marginBottom: 1 },
  txDate: { fontSize: 10, color: colors.textMuted },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txPos: { color: colors.plumbob },
  txNeg: { color: colors.error },

  // Plus card
  plusCard: {
    marginHorizontal: 18, marginBottom: 28,
    backgroundColor: colors.bgCard, borderRadius: 20, padding: 20,
    borderWidth: 2, borderColor: colors.plumbobBorder,
    shadowColor: colors.plumbob, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  plusHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  plusIcon: { fontSize: 22, color: colors.plumbob },
  plusTitles: { flex: 1, gap: 4 },
  plusTitle: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
  plusActiveBadge: {
    backgroundColor: colors.plumbobGlow, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start',
  },
  plusActiveTxt: { fontSize: 10, fontWeight: '800', color: colors.plumbob },
  plusPrice: { fontSize: 17, fontWeight: '900', color: colors.plumbob },
  plusBenefits: { gap: 8, marginBottom: 16 },
  plusBenefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  plusCheck: { fontSize: 13, color: colors.plumbob, fontWeight: '800', marginTop: 1 },
  plusBenefit: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  plusBtn: {
    backgroundColor: colors.plumbob, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: colors.plumbob, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  plusBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
