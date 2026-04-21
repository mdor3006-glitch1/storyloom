import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';

export type AuthStackParamList = {
  Splash: undefined;
  Auth: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
    </Stack.Navigator>
  );
}
