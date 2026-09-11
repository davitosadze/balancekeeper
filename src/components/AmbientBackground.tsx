import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';

interface Orb {
  top: number;
  left: number;
  size: number;
  color: string;
  driftX: number;
  driftY: number;
  duration: number;
}

const ORBS: Orb[] = [
  { top: -60, left: -70, size: 260, color: 'rgba(6, 182, 212, 0.16)', driftX: 20, driftY: -16, duration: 11000 },
  { top: 300, left: -60, size: 240, color: 'rgba(16, 185, 129, 0.13)', driftX: -18, driftY: 14, duration: 13000 },
  { top: 620, left: 220, color: 'rgba(139, 92, 246, 0.10)', size: 220, driftX: 16, driftY: -12, duration: 15000 },
];

/**
 * Soft drifting ambient glow orbs for a screen's dark background, matching
 * the design reference's starfield/glow treatment. Purely decorative;
 * renders behind all other content via absoluteFillObject + pointerEvents none.
 */
export default function AmbientBackground() {
  const { width } = useWindowDimensions();

  return (
    <Animated.View pointerEvents="none" style={styles.container}>
      {ORBS.map((orb, i) => (
        <Orb key={i} orb={orb} screenWidth={width} />
      ))}
    </Animated.View>
  );
}

function Orb({ orb, screenWidth }: { orb: Orb; screenWidth: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: orb.duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: orb.duration, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * orb.driftX },
      { translateY: progress.value * orb.driftY },
    ],
  }));

  const left = orb.left < 0 ? orb.left : Math.min(orb.left, screenWidth - orb.size * 0.4);

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          top: orb.top,
          left,
          width: orb.size,
          height: orb.size,
          borderRadius: orb.size / 2,
          backgroundColor: orb.color,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
  },
});
