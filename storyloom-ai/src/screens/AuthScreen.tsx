import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { useCreditStore } from '../store/creditStore';
import { AuthStackParamList } from '../navigation/AuthStack';

type Nav = StackNavigationProp<AuthStackParamList, 'Auth'>;

// Required for OAuth redirect handling in Expo Go / standalone builds
WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'landing' | 'email_signin' | 'email_signup';

export default function AuthScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const login = useAuthStore((s) => s.login);
  const setBalance = useCreditStore((s) => s.setBalance);

  const [mode, setMode] = useState<AuthMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  // ----------------------------------------------------------
  // Shared: after any successful sign-in, hydrate stores
  // ----------------------------------------------------------
  async function handleSessionEstablished(accessToken: string) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      Alert.alert('Error', t('errors.generic'));
      return;
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!userRow) {
      Alert.alert('Error', t('errors.generic'));
      return;
    }

    login(userRow, accessToken);
    setBalance(userRow.credit_balance);

    // First-time user → Onboarding; AppNavigator handles MainStack switch
    const isNew = !userRow.last_active_at;
    if (isNew) {
      navigation.replace('Onboarding');
    }
  }

  // ----------------------------------------------------------
  // Google Sign-In (browser-based OAuth — works in Expo Go)
  // ----------------------------------------------------------
  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) throw error ?? new Error('Could not start Google Sign-In');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) throw sessionError;
        if (sessionData.session) {
          await handleSessionEstablished(sessionData.session.access_token);
        }
      }
    } catch (err: any) {
      Alert.alert('Google Sign-In failed', err.message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Apple Sign-In (iOS only)
  // ----------------------------------------------------------
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

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      await handleSessionEstablished(data.session!.access_token);
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple Sign-In failed', err.message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Email Sign-In
  // ----------------------------------------------------------
  async function handleEmailSignIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Sign-In failed', 'Invalid email or password.');
        return;
      }
      await handleSessionEstablished(data.session!.access_token);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Email Sign-Up
  // ----------------------------------------------------------
  async function handleEmailSignUp() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (!ageConfirmed) {
      Alert.alert('Age Confirmation Required', t('auth.age_confirm'));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: displayName || email.split('@')[0] },
        },
      });
      if (error) {
        Alert.alert('Sign-Up failed', error.message);
        return;
      }
      if (!data.session) {
        Alert.alert(
          'Check your email',
          `We sent a confirmation link to ${email}. Please verify your email to continue.`
        );
        setMode('landing');
        return;
      }
      await handleSessionEstablished(data.session.access_token);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  if (mode === 'email_signin') {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.subtitle}>Sign in with Email</Text>

        <TextInput
          style={styles.input}
          placeholder={t('auth.email_placeholder')}
          placeholderTextColor="#A0AEBA"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password_placeholder')}
          placeholderTextColor="#A0AEBA"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.disabled]}
          onPress={handleEmailSignIn}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode('email_signup')} style={styles.switchLink}>
          <Text style={styles.linkText}>No account? Create one</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('landing')} style={styles.switchLink}>
          <Text style={styles.linkText}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === 'email_signup') {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.subtitle}>{t('auth.sign_up')}</Text>

        <TextInput
          style={styles.input}
          placeholder="Display name (optional)"
          placeholderTextColor="#A0AEBA"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.email_placeholder')}
          placeholderTextColor="#A0AEBA"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password_placeholder')}
          placeholderTextColor="#A0AEBA"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAgeConfirmed((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, ageConfirmed && styles.checkboxChecked]}>
            {ageConfirmed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>{t('auth.age_confirm')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.disabled]}
          onPress={handleEmailSignUp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t('auth.sign_up')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode('email_signin')} style={styles.switchLink}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('landing')} style={styles.switchLink}>
          <Text style={styles.linkText}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Landing
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('app.name')}</Text>
      <Text style={styles.tagline}>{t('app.tagline')}</Text>
      <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        onPress={handleGoogleSignIn}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>{t('auth.sign_in_google')}</Text>}
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.button, styles.appleButton, loading && styles.disabled]}
          onPress={handleAppleSignIn}
          disabled={loading}
        >
          <Text style={[styles.buttonText]}>{t('auth.sign_in_apple')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.switchLink} onPress={() => setMode('email_signin')} disabled={loading}>
        <Text style={styles.linkText}>{t('auth.sign_in_email')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.switchLink} onPress={() => setMode('email_signup')} disabled={loading}>
        <Text style={styles.linkText}>{t('auth.sign_up')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#2E4057', marginBottom: 4 },
  tagline: { fontSize: 13, color: '#048A81', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6B7C93', marginBottom: 48, textAlign: 'center' },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#F0F4F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#2E4057',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  button: {
    width: '100%',
    backgroundColor: '#048A81',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  appleButton: { backgroundColor: '#2E4057' },
  disabled: { opacity: 0.6 },
  switchLink: { paddingVertical: 8 },
  linkText: { color: '#048A81', fontSize: 14, textDecorationLine: 'underline' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, width: '100%' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#048A81',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#048A81' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, color: '#2E4057' },
});
