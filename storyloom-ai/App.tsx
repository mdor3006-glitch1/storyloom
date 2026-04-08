import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import i18n from './src/i18n/i18n';
import { useAuthStore } from './src/store/authStore';

function RTLController() {
  const language = useAuthStore((s) => s.user?.language ?? 'en');

  useEffect(() => {
    const isRTL = language === 'he';
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
      // In production a reload would be needed; during dev Expo handles it.
    }
    i18n.changeLanguage(language);
  }, [language]);

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RTLController />
        <StatusBar style="dark" backgroundColor="#FAFAFA" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
