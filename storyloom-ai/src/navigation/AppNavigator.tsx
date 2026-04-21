import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { linking } from './linking';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import OnboardingScreen from '../screens/OnboardingScreen';
import { useAuthStore } from '../store/authStore';
import { SoundService } from '../services/SoundService';
import DiamondLoader from '../components/DiamondLoader';

const OnboardingNav = createStackNavigator();
function OnboardingNavigator() {
  return (
    <OnboardingNav.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingNav.Screen name="Onboarding" component={OnboardingScreen} />
    </OnboardingNav.Navigator>
  );
}

export default function AppNavigator() {
  const isLoggedIn     = useAuthStore((s) => s.isLoggedIn);
  const hasOnboarded   = useAuthStore((s) => s.hasOnboarded);
  const isInitializing = useAuthStore((s) => s.isInitializing);

  useEffect(() => {
    SoundService.init();
  }, []);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0f1e', alignItems: 'center', justifyContent: 'center' }}>
        <DiamondLoader size={56} animated />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {!isLoggedIn
        ? <AuthStack />
        : !hasOnboarded
        ? <OnboardingNavigator />
        : <MainStack />
      }
    </NavigationContainer>
  );
}
