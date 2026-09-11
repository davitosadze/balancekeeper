import React from 'react';
import { Image, View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Realistic gameplay scene background: the real lake/mountain/table photo,
 * cover-fit so its proportions stay correct (no stretching), with a light
 * warm gradient near the bottom edge for depth and a crisp highlight line
 * where the photographed table's front edge sits.
 *
 * The image is sized with explicit window pixel dimensions rather than
 * percentage/absoluteFill sizing — with several route screens mounted at
 * once (expo-router keeps the stack alive for back-gesture support), the
 * active screen's flex chain can resolve ambiguously on web, leaving an
 * `<img>` unstyled at its native resolution instead of stretched to fill.
 * Explicit pixel dimensions sidestep that regardless of ancestor sizing.
 */
export default function SceneBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={styles.container}>
      <Image
        source={require('../../assets/game-background.jpeg')}
        resizeMode="cover"
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
      />
      <LinearGradient
        colors={['rgba(91, 49, 29, 0)', 'rgba(91, 49, 29, 0.22)']}
        locations={[0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tableHighlight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: '#8c5332',
  },
  tableHighlight: {
    position: 'absolute',
    top: '49%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 220, 157, 0.35)',
  },
});
