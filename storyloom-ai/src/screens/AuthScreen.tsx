import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  // ActivityIndicator replaced by DiamondLoader
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from '../services/supabase';
import { colors } from '../theme/colors';
import Plumbob from '../components/Plumbob';
import DiamondLoader from '../components/DiamondLoader';
import LogoComponent from '../components/LogoComponent';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'landing' | 'email_signin' | 'email_signup';

export default function AuthScreen() {
  const { t } = useTranslation();

  const [mode, setMode]               = useState<AuthMode>('landing');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading]         = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error ?? new Error('Could not start Google Sign-In');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type === 'success' && result.url) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) throw sessionError;
      }
    } catch (err: any) {
      Alert.alert('Google Sign-In failed', err.message ?? t('errors.generic'));
    } finally { setLoading(false); }
  }

  async function handleAppleSignIn() {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple Sign-In failed', err.message ?? t('errors.generic'));
    } finally { setLoading(false); }
  }

  async function handleDevLogin() {
    const DEV_EMAIL    = 'shalevsaa1608+storyloomdev@gmail.com';
    const DEV_PASSWORD = 'DevStoryloom!2026';
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert(
        'Dev login failed',
        err?.message ??
          'Dev user not found. Create it in Supabase → Authentication → Users (Auto Confirm ON).',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignIn() {
    if (!email || !password) { Alert.alert('Error', 'Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Sign-In failed', 'Invalid email or password.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? t('errors.generic'));
    } finally { setLoading(false); }
  }

  async function handleEmailSignUp() {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    if (password.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters.'); return; }
    if (!ageConfirmed) { Alert.alert('Age Confirmation Required', t('auth.age_confirm')); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName || email.split('@')[0] } },
      });
      if (error) { Alert.alert('Sign-Up failed', error.message); return; }
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          Alert.alert(
            'Sign-Up failed',
            'Account created but auto sign-in is blocked. Disable "Confirm email" in Supabase → Authentication → Providers → Email.'
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? t('errors.generic'));
    } finally { setLoading(false); }
  }

  // ── Email forms ──────────────────────────────────────────────
  if (mode === 'email_signin' || mode === 'email_signup') {
    const isSignup = mode === 'email_signup';
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setMode('landing')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.formHeader}>
            <Plumbob size={36} color={colors.plumbob} />
            <Text style={styles.formTitle}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>
          </View>
          <Text style={styles.formSubtitle}>
            {isSignup ? 'Join StoryLoom AI — 100 free credits await' : 'Sign in to continue your story'}
          </Text>

          {isSignup && (
            <TextInput
              style={styles.input}
              placeholder="Display name (optional)"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {isSignup && (
            <TouchableOpacity style={styles.checkRow} onPress={() => setAgeConfirmed((v) => !v)}>
              <View style={[styles.checkbox, ageConfirmed && styles.checkboxChecked]}>
                {ageConfirmed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>{t('auth.age_confirm')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={isSignup ? handleEmailSignUp : handleEmailSignIn}
            disabled={loading}
          >
            {loading
              ? <DiamondLoader size={22} animated showSparkles={false} />
              : <Text style={styles.primaryBtnText}>{isSignup ? 'Create Account' : 'Sign In'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode(isSignup ? 'email_signin' : 'email_signup')}
            style={styles.switchLink}
          >
            <Text style={styles.switchLinkText}>
              {isSignup ? 'Already have an account? Sign in' : 'No account? Create one'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Landing ──────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Background glows */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Logo area */}
      <View style={styles.logoArea}>
        <LogoComponent size="large" showWordmark animated />
        <Text style={styles.tagline}>Your story. Your face. Infinite possibilities.</Text>
      </View>

      {/* Auth panel */}
      <View style={styles.authPanel}>
        {/* Google */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading
            ? <DiamondLoader size={22} animated showSparkles={false} />
            : <Text style={styles.primaryBtnText}>🔍  Continue with Google</Text>}
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.secondaryBtn, loading && styles.btnDisabled]}
            onPress={handleAppleSignIn}
            disabled={loading}
          >
            <Text style={styles.secondaryBtnText}>  Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.ghostBtn} onPress={() => setMode('email_signin')} disabled={loading}>
          <Text style={styles.ghostBtnText}>✉️  Sign in with Email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode('email_signup')} disabled={loading}>
          <Text style={styles.signupLink}>
            New here? <Text style={styles.signupLinkBold}>Create a free account ✨</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.devBtn, loading && styles.btnDisabled]}
          onPress={handleDevLogin}
          disabled={loading}
          activeOpacity={0.75}
        >
          <Text style={styles.devBtnText}>🧪  DEV LOGIN (bypass)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  blob1: {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(58,45,140,0.70)',
  },
  blob2: {
    position: 'absolute', bottom: 200, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(107,32,96,0.70)',
  },

  // Logo
  logoArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 60,
  },
  logoTextRow: { flexDirection: 'row', gap: 0, marginTop: 16 },
  appNameStory: {
    fontSize: 30, fontWeight: '900',
    color: colors.textPrimary, letterSpacing: 7,
  },
  appNameLoom: {
    fontSize: 30, fontWeight: '900',
    color: colors.plumbob, letterSpacing: 7,
  },
  greenDivider: { width: 60, height: 2, backgroundColor: colors.plumbob, marginVertical: 8 },
  aiLabel: {
    fontSize: 11, fontWeight: '800',
    color: colors.plumbob, letterSpacing: 6, marginBottom: 12,
  },
  tagline: {
    fontSize: 12, color: colors.textSecondary,
    letterSpacing: 0.3, textAlign: 'center', paddingHorizontal: 40,
  },

  // Auth panel (bottom sheet)
  authPanel: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 26, paddingTop: 26, paddingBottom: 44,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    gap: 11,
  },

  primaryBtn: {
    backgroundColor: 'rgba(127,119,221,0.80)',
    borderRadius: 999, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(127,119,221,0.90)',
    shadowColor: colors.plumbob,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 8, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  secondaryBtnText: { color: 'rgba(255,255,255,0.50)', fontSize: 16, fontWeight: '600' },
  ghostBtn: {
    borderRadius: 8, paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  ghostBtnText: { color: 'rgba(255,255,255,0.50)', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.45 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 13 },

  signupLink: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingTop: 2 },
  signupLinkBold: { color: colors.plumbob, fontWeight: '700' },

  devBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
  },
  devBtnText: { color: colors.credit, fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  // Email forms
  formContainer: {
    flexGrow: 1, paddingHorizontal: 26,
    paddingTop: 80, paddingBottom: 48, gap: 13,
  },
  backBtn: { marginBottom: 6 },
  backBtnText: { color: colors.textSecondary, fontSize: 15 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  formTitle: {
    fontSize: 28, fontWeight: '900',
    color: colors.textPrimary, letterSpacing: -0.3,
  },
  formSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.textPrimary,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard, borderRadius: 12,
    borderWidth: 0.5, borderColor: colors.border,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 0.5, borderColor: colors.plumbob,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.plumbob },
  checkmark: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  switchLink: { alignItems: 'center', paddingVertical: 4 },
  switchLinkText: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
