import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { linking } from './linking';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import { useAuthStore } from '../store/authStore';

export default function AppNavigator() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <NavigationContainer linking={linking}>
      {isLoggedIn ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
