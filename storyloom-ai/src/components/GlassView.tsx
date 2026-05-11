import React from 'react';
import { Platform, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassViewProps {
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  style?: ViewStyle;
  children?: React.ReactNode;
  androidFallbackColor?: string;
}

export default function GlassView({
  intensity = 60,
  tint = 'dark',
  style,
  children,
  androidFallbackColor = 'rgba(0,0,0,0.55)',
}: GlassViewProps) {
  if (Platform.OS === 'android') {
    return (
      <View style={[style, { backgroundColor: androidFallbackColor }]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={[{ overflow: 'hidden' }, style]}>
      {children}
    </BlurView>
  );
}
