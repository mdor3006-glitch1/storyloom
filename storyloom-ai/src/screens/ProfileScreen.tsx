import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useStoryStore } from '../store/storyStore';
import { useCreditStore } from '../store/creditStore';
import { colors } from '../theme/colors';
import DiamondLoader from '../components/DiamondLoader';
import { SoundService } from '../services/SoundService';
import Plumbob from '../components/Plumbob';
import api from '../services/api';

interface Achievement {
  id: string;
  label: string;
  description: string;
  hint: string;
  unlocked_at: string | null;
}

const ACHIEVEMENT_DEFS: Achievement[] = [
  { id: 'first_chapter',   label: 'First Chapter',     description: 'Completed your first story',          hint: 'Complete any story',                   unlocked_at: null },
  { id: 'the_betrayer',    label: 'The Betrayer',       description: 'Chose betrayal 3 times',              hint: 'Choose betrayal options across stories', unlocked_at: null },
  { id: 'century_reader',  label: 'Century Reader',     description: 'Read 100 total scenes',               hint: 'Keep reading scenes',                   unlocked_at: null },
  { id: 'twist_addict',    label: 'Twist Addict',       description: 'Experienced 10 plot twists',          hint: 'Encounter unexpected twists',            unlocked_at: null },
  { id: 'plus_member',     label: 'Plus Member',        description: 'Subscribed to StoryLoom Plus',        hint: 'Subscribe to Plus',                     unlocked_at: null },
  { id: 'romantic',        label: 'Romantic',           description: 'Completed 3 romance stories',         hint: 'Complete romance stories',               unlocked_at: null },
  { id: 'dark_soul',       label: 'Dark Soul',          description: 'Completed a horror or thriller story', hint: 'Brave the darkness',                   unlocked_at: null },
  { id: 'comedy_king',     label: 'Comedy Royalty',     description: 'Completed a comedy story',            hint: 'Make the AI laugh',                     unlocked_at: null },
  { id: 'loyal',           label: 'Loyal',              description: '7-day streak reached',                hint: 'Play 7 days in a row',                  unlocked_at: null },
  { id: 'devoted',         label: 'Devoted',            description: '30-day streak reached',               hint: 'Play 30 days in a row',                 unlocked_at: null },
  { id: 'collector',       label: 'Collector',          description: '3 favourited completed stories',      hint: 'Favourite completed stories',            unlocked_at: null },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user        = useAuthStore((s) => s.user);
  const logout      = useAuthStore((s) => s.logout);
  const clearStory  = useStoryStore((s) => s.clearStory);
  const setBalance  = useCreditStore((s) => s.setBalance);
  const balance     = useCreditStore((s) => s.balance);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [muted, setMuted] = useState(SoundService.isMuted);
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENT_DEFS);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  const initial = (user?.display_name || user?.email || 'U').charAt(0).toUpperCase();

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      const [achieveRes, streakRes] = await Promise.allSettled([
        api.get('/users/achievements').catch(() => ({ data: { achievements: [] } })),
        api.get('/users/streak').catch(() => ({ data: { streak: 0, longest_streak: 0 } })),
      ]);
      if (achieveRes.status === 'fulfilled') {
        const unlocked: string[] = (achieveRes.value as any).data?.achievements?.map((a: any) => a.achievement_id) ?? [];
        setAchievements(prev => prev.map(a => ({
          ...a,
          unlocked_at: unlocked.includes(a.id) ? new Date().toISOString() : null,
        })));
      }
      if (streakRes.status === 'fulfilled') {
        const d = (streakRes.value as any).data;
        setStreak(d?.streak ?? 0);
        setLongestStreak(d?.longest_streak ?? 0);
      }
    } catch { /* non-critical */ }
  }

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    await SoundService.setMuted(next);
    if (!next) SoundService.fadeInMenuMusic();
    else SoundService.stopMenuMusic();
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: async () => {
        try { await api.post('/auth/logout'); } catch { /* best-effort */ }
        clearStory(); setBalance(0); logout();
      }},
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert('Delete Account', 'All your data will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeleteLoading(true);
        try {
          await api.delete('/users/me');
          clearStory(); setBalance(0); logout();
        } catch { Alert.alert('Error', 'Something went wrong.'); }
        finally { setDeleteLoading(false); }
      }},
    ]);
  }

  const unlockedCount = achievements.filter(a => a.unlocked_at).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Plumbob size={26} color={colors.plumbob} />
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Avatar card */}
      {user && (
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>{user.display_name || 'Story Explorer'}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.plumbob }]}>{balance}</Text>
          <Text style={styles.statLabel}>Credits</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#F97316' }]}>🔥 {streak}</Text>
          <Text style={styles.statLabel}>Day streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{longestStreak}</Text>
          <Text style={styles.statLabel}>Best streak</Text>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>⚙️  SETTINGS</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingIcon}>{muted ? '🔇' : '🔊'}</Text>
            <Text style={styles.settingLabel}>Sound & Music</Text>
          </View>
          <Switch
            value={!muted}
            onValueChange={toggleMute}
            trackColor={{ false: colors.border, true: colors.plumbob + '80' }}
            thumbColor={!muted ? colors.plumbob : '#ccc'}
          />
        </View>
      </View>

      {/* Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>🏆  ACHIEVEMENTS ({unlockedCount}/{achievements.length})</Text>
        {achievements.map(a => (
          <View key={a.id} style={[styles.achieveRow, !a.unlocked_at && styles.achieveRowLocked]}>
            <View style={[styles.achieveIcon, a.unlocked_at && { borderColor: colors.plumbob, backgroundColor: colors.plumbobGlow }]}>
              <Text>{a.unlocked_at ? '◆' : '◇'}</Text>
            </View>
            <View style={styles.achieveBody}>
              <Text style={[styles.achieveLabel, !a.unlocked_at && styles.achieveLabelLocked]}>{a.label}</Text>
              <Text style={styles.achieveDesc}>{a.unlocked_at ? a.description : a.hint}</Text>
              {a.unlocked_at && (
                <Text style={styles.achieveDate}>
                  Unlocked {new Date(a.unlocked_at).toLocaleDateString()}
                </Text>
              )}
            </View>
            {a.unlocked_at && <Text style={styles.achieveCheck}>✓</Text>}
          </View>
        ))}
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>👤  ACCOUNT</Text>
        <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingIcon}>🚪</Text>
            <Text style={styles.settingLabel}>Sign Out</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingRow, styles.dangerRow]} onPress={handleDeleteAccount} disabled={deleteLoading}>
          {deleteLoading
            ? <DiamondLoader size={20} animated showSparkles={false} color={colors.error} />
            : <>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>🗑️</Text>
                  <Text style={[styles.settingLabel, { color: colors.error }]}>Delete Account</Text>
                </View>
                <Text style={styles.rowArrow}>›</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>StoryLoom AI · v1.0 · Made with ◆</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingBottom: 20, paddingTop: 0,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },

  avatarCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.bgCard, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
    gap: 16,
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.plumbobGlow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.plumbobBorder,
  },
  avatarInitial: { fontSize: 26, fontWeight: '900', color: colors.plumbob },
  userInfo: { flex: 1 },
  displayName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 3 },
  email: { fontSize: 12, color: colors.textMuted },

  statsRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 20, marginBottom: 20,
  },
  statCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: 16,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: colors.plumbob,
    letterSpacing: 2, marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: colors.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 6,
  },
  dangerRow: { borderColor: colors.error + '30' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingIcon: { fontSize: 18 },
  settingLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  rowArrow: { fontSize: 18, color: colors.textMuted },

  // Achievements
  achieveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.plumbobBorder, marginBottom: 8,
  },
  achieveRowLocked: { borderColor: colors.border, opacity: 0.6 },
  achieveIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  achieveBody:      { flex: 1 },
  achieveLabel:     { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  achieveLabelLocked: { color: colors.textMuted },
  achieveDesc:      { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  achieveDate:      { fontSize: 10, color: colors.plumbob, marginTop: 2 },
  achieveCheck:     { fontSize: 16, color: colors.plumbob, fontWeight: '900' },

  version: {
    textAlign: 'center', fontSize: 11, color: colors.textMuted,
    letterSpacing: 0.5, paddingVertical: 16,
  },
});
