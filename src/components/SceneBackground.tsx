import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SKY_THEME } from '@/utils/constants';

const HORIZON_RATIO = 0.38;

/**
 * Clean, flat outdoor scene backdrop for the Gameplay board and MainMenu
 * hero: a sky gradient, two flat mountain silhouettes, a flat lake band with
 * a couple of shimmer highlights, and a warm wood table with light grain.
 * Deliberately simple — no photo-realistic layering — so it reads as a
 * polished flat illustration rather than a busy or glitchy scene. Every
 * other screen keeps the dark AmbientBackground.
 */
export default function SceneBackground() {
  const { width, height } = useWindowDimensions();
  const horizonY = height * HORIZON_RATIO;
  const tableTop = height * 0.68;

  return (
    <View pointerEvents="none" style={styles.container}>
      <LinearGradient colors={SKY_THEME.skyGradient} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.sunGlow, { backgroundColor: SKY_THEME.sunGlow }]} />

      <View
        style={[
          styles.mountain,
          { width: width * 1.3, height: 100, left: width * 0.2, top: horizonY - 35, backgroundColor: SKY_THEME.mountainFar, opacity: 0.7 },
        ]}
      />
      <View
        style={[
          styles.mountain,
          { width: width * 1.4, height: 120, left: -width * 0.2, top: horizonY - 22, backgroundColor: SKY_THEME.mountainNear },
        ]}
      />

      <LinearGradient colors={SKY_THEME.water} style={[styles.water, { top: horizonY, height: height - horizonY }]} />
      <View style={[styles.shimmer, { top: horizonY + 30, left: width * 0.15, width: width * 0.25 }]} />
      <View style={[styles.shimmer, { top: horizonY + 58, left: width * 0.5, width: width * 0.28, opacity: 0.3 }]} />

      <LinearGradient
        colors={['#c98f57', '#8a5a36', '#4a2c18']}
        style={[styles.table, { top: tableTop, height: height - tableTop }]}
      />
      <View style={[styles.tableHighlight, { top: tableTop + 2 }]} />
      {Array.from({ length: 6 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.woodGrain,
            {
              top: tableTop + height * (0.03 + index * 0.045),
              left: -width * 0.1 + (index % 3) * width * 0.16,
              width: width * (0.4 + (index % 2) * 0.25),
              opacity: 0.25 - (index / 6) * 0.1,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  sunGlow: {
    position: 'absolute',
    top: 20,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  mountain: {
    position: 'absolute',
    borderRadius: 999,
  },
  water: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  shimmer: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    opacity: 0.4,
  },
  table: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  tableHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 224, 180, 0.45)',
  },
  woodGrain: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(58, 28, 15, 0.35)',
    transform: [{ rotate: '-1deg' }],
  },
});
