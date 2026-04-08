import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useAuthStore } from '../store/authStore';
import { useStoryStore } from '../store/storyStore';
import { useCreditStore } from '../store/creditStore';
import api from '../services/api';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user        = useAuthStore((s) => s.user);
  const logout      = useAuthStore((s) => s.logout);
  const updateUser  = useAuthStore((s) => s.updateUser);
  const clearStory  = useStoryStore((s) => s.clearStory);
  const setBalance  = useCreditStore((s) => s.setBalance);

  const [languageLoading, setLanguageLoading] = useState(false);
  const [deleteLoading,   setDeleteLoading]   = useState(false);

  const isHebrew = user?.language === 'he';

  async function handleLanguageToggle(val: boolean) {
    const lang = val ? 'he' : 'en';
    setLanguageLoading(true);
    try {
      await api.patch('/users/me', { language: lang });
      updateUser({ language: lang });
      await i18n.changeLanguage(lang);
    } catch {
      Alert.alert('Error', t('errors.generic'));
    } finally {
      setLanguageLoading(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', onPress: () => {
          clearStory();
          setBalance(0);
          logout();
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert('Delete Account', t('profile.delete_confirm'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleteLoading(true);
          try {
            await api.delete('/users/me');
            clearStory();
            setBalance(0);
            logout();
          } catch {
            Alert.alert('Error', t('errors.generic'));
          } finally {
            setDeleteLoading(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* User info */}
      {user && (
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(user.display_name || user.email).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.displayName}>{user.display_name || 'User'}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Settings</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('profile.language')}</Text>
          <View style={styles.rowRight}>
            <Text style={styles.langLabel}>EN</Text>
            {languageLoading
              ? <ActivityIndicator size="small" color="#048A81" />
              : <Switch
                  value={isHebrew}
                  onValueChange={handleLanguageToggle}
                  trackColor={{ false: '#DCE4EB', true: '#A8D5D1' }}
                  thumbColor={isHebrew ? '#048A81' : '#FAFAFA'}
                />
            }
            <Text style={styles.langLabel}>HE</Text>
          </View>
        </View>
      </View>

      {/* Account actions */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>

        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.rowLabel}>{t('profile.logout')}</Text>
          <Text style={styles.rowArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.row, styles.dangerRow]} onPress={handleDeleteAccount} disabled={deleteLoading} activeOpacity={0.7}>
          {deleteLoading
            ? <ActivityIndicator size="small" color="#E0533A" />
            : <>
                <Text style={styles.dangerLabel}>{t('profile.delete_account')}</Text>
                <Text style={styles.rowArrow}>→</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>StoryLoom AI · v1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  title: { fontSize: 22, fontWeight: '800', color: '#2E4057' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#048A81',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '700', color: '#fff' },
  displayName: { fontSize: 16, fontWeight: '700', color: '#2E4057', marginBottom: 2 },
  email: { fontSize: 13, color: '#6B7C93' },
  section: { paddingHorizontal: 24, marginTop: 8, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#A0AEBA', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  rowLabel: { fontSize: 16, color: '#2E4057' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowArrow: { fontSize: 16, color: '#A0AEBA' },
  langLabel: { fontSize: 13, color: '#6B7C93', fontWeight: '600' },
  dangerRow: { borderBottomWidth: 0 },
  dangerLabel: { fontSize: 16, color: '#E0533A' },
  version: { position: 'absolute', bottom: 40, alignSelf: 'center', fontSize: 12, color: '#C8D8DC' },
});
