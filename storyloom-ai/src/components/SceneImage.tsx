import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';

interface Props {
  uri: string | null;
}

export default function SceneImage({ uri }: Props) {
  const { width } = useWindowDimensions();
  const height = Math.round((width * 9) / 16); // 16:9

  return (
    <View style={[styles.container, { width, height }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
      ) : (
        <View style={[styles.placeholder, { width, height }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#2E4057' },
  placeholder: { backgroundColor: '#2E4057' },
});
