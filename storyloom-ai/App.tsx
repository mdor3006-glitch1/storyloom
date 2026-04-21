import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import './src/i18n/i18n';
import { supabase } from './src/services/supabase';
import { useAuthStore } from './src/store/authStore';
import { useCreditStore } from './src/store/creditStore';

// ── Session restoration via onAuthStateChange ────────────────────
// This is the single source of truth for auth state. AuthScreen only
// calls Supabase methods; this listener drives all store updates.
function AuthListener() {
  const login          = useAuthStore((s) => s.login);
  const logout         = useAuthStore((s) => s.logout);
  const setHasOnboarded = useAuthStore((s) => s.setHasOnboarded);
  const setIsInitializing = useAuthStore((s) => s.setIsInitializing);
  const setBalance     = useCreditStore((s) => s.setBalance);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // No session at startup or explicit sign-out
        if (!session) {
          if (event === 'SIGNED_OUT') logout();
          setIsInitializing(false);
          return;
        }

        // We have a valid session — hydrate the stores
        try {
          const { data: userRow, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error || !userRow) {
            // Profile not ready yet (trigger might be delayed) — retry once
            await new Promise((r) => setTimeout(r, 1500));
            const { data: retryRow } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (retryRow) {
              login(retryRow, session.access_token);
              setBalance(retryRow.credit_balance);
              // Existing users (last_active_at set) skip onboarding
              if (retryRow.last_active_at) setHasOnboarded();
            }
            return;
          }

          login(userRow, session.access_token);
          setBalance(userRow.credit_balance);
          if (userRow.last_active_at) setHasOnboarded();
        } catch {
          // Swallow — user stays logged out; isInitializing will be resolved
        } finally {
          setIsInitializing(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthListener />
        <StatusBar style="light" backgroundColor="#0A0A1A" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
