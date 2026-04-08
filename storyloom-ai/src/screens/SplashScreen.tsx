import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AuthStack';
import { useAuthStore } from '../store/authStore';

type Nav = StackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const { isLoggedIn, hasOnboarded } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoggedIn) return; // AppNavigator handles redirect to MainStack
      if (hasOnboarded) {
        navigation.replace('Auth');
      } else {
        navigation.replace('Auth');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>StoryLoom AI</Text>
      <Text style={styles.tagline}>Your story. Your face. Infinite possibilities.</Text>
      <ActivityIndicator color="#048A81" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#2E4057', marginBottom: 8 },
  tagline: { fontSize: 14, color: '#048A81', marginBottom: 40 },
  loader: { marginTop: 16 },
});
