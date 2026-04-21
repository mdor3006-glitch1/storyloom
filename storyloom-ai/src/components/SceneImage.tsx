import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import { colors } from '../theme/colors';
import Plumbob from './Plumbob';

interface Props {
  uri: string | null;
  /** Override height. When omitted the component uses the exact 3:4 aspect ratio
   *  of the FLUX-generated portrait image — guaranteeing zero cropping. */
  height?: number;
}

export default function SceneImage({ uri, height: heightProp }: Props) {
  const { width } = useWindowDimensions();
  // portrait_4_3 images are 768×1024 — exact 3:4 (width:height) ratio
  const height = heightProp ?? Math.round(width * (4 / 3));
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!uri) {
      pulseAnim.setValue(0.5);
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [uri, pulseAnim]);

  return (
    <View style={[styles.container, { width, height }]}>
      {uri ? (
        /* resizeMode="cover" with a container that matches the image AR → zero cropping */
        <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
      ) : (
        <Animated.View style={[styles.placeholder, { width, height, opacity: pulseAnim }]}>
          {/* Sims-style loading placeholder */}
          <View style={styles.loadingInner}>
            <Plumbob size={56} animated />
            <View style={styles.loadingBars}>
              {[70, 90, 60, 80, 50].map((w, i) => (
                <View key={i} style={[styles.loadingBar, { width: `${w}%` as unknown as number }]} />
              ))}
            </View>
          </View>
        </Animated.View>
      )}
      {/* Subtle bottom vignette to blend image into content below */}
      <View style={[styles.bottomFade, { width }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { backgroundColor: colors.bgCard, position: 'relative', overflow: 'hidden' },
  placeholder: { backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  loadingInner: { alignItems: 'center', gap: 24 },
  loadingBars:  { gap: 10, alignItems: 'center', width: '100%', paddingHorizontal: 48 },
  loadingBar:   { height: 7, backgroundColor: colors.border, borderRadius: 4 },
  bottomFade: {
    position: 'absolute',
    bottom:   0,
    height:   60,
    backgroundColor: colors.bg,
    opacity:  0.45,
  },
});
