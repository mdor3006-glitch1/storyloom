import React from 'react';
import { View, ViewStyle } from 'react-native';

let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassSupported = false;

try {
  const lib = require('@callstack/liquid-glass');
  LiquidGlassView = lib.LiquidGlassView;
  isLiquidGlassSupported = lib.isLiquidGlassSupported ?? false;
} catch {}

interface GlassViewProps {
  intensity?: number;
  tint?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
  androidFallbackColor?: string;
}

export default function GlassView({
  style,
  children,
  androidFallbackColor = 'rgba(0,0,0,0.55)',
}: GlassViewProps) {
  if (isLiquidGlassSupported && LiquidGlassView) {
    return (
      <LiquidGlassView
        effect="regular"
        colorScheme="dark"
        style={[style, { overflow: 'hidden' }]}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <View style={[style, { backgroundColor: androidFallbackColor }]}>
      {children}
    </View>
  );
}
