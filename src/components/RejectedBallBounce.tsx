import React, { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { Ball as BallType } from '@/types/game';
import { getBallSize } from '@/utils/constants';
import Ball from './Ball';

export interface RejectedBallBounceProps {
  ball: BallType;
  /** Screen point (root-relative) the ball was released at. */
  from: { x: number; y: number };
  /** The bottle's center point (root-relative) it was rejected by. */
  to: { x: number; y: number };
  /** Changing this timestamp re-triggers the animation for a new rejection. */
  at: number;
}

const APPROACH_MS = 130;
const RECOIL_MS = 320;
/** Total lifetime of the bounce animation; callers can use this to unmount the component once it finishes. */
export const REJECTED_BALL_ANIMATION_MS = APPROACH_MS + RECOIL_MS;
const RASTERIZE_PROPS = Platform.OS === "android"
  ? { renderToHardwareTextureAndroid: true }
  : { shouldRasterizeIOS: true };

/**
 * A ball that failed to enter a bottle (an overload attempt) visually flies
 * the rest of the way toward the bottle, then bounces back out past its
 * release point and fades — so the rejection reads as a physical collision
 * rather than the ball silently vanishing. Purely decorative; the store
 * already rejected the placement before this ever renders.
 */
export default function RejectedBallBounce({ ball, from, to, at }: RejectedBallBounceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withSequence(
      withTiming(0.7, { duration: APPROACH_MS, easing: Easing.out(Easing.quad) }),
      withTiming(-0.3, { duration: RECOIL_MS, easing: Easing.out(Easing.cubic) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const size = getBallSize(ball.weight);
  const style = useAnimatedStyle(() => {
    const x = from.x + (to.x - from.x) * progress.value;
    const y = from.y + (to.y - from.y) * progress.value;
    const opacity = interpolate(progress.value, [-0.3, 0, 0.7], [0, 1, 1], Extrapolation.CLAMP);
    return {
      left: x - size / 2,
      top: y - size / 2,
      opacity,
    };
  });

  return (
    <Animated.View pointerEvents="none" {...RASTERIZE_PROPS} style={[styles.ball, style]}>
      <Ball color={ball.color} weight={ball.weight} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ball: {
    position: 'absolute',
  },
});
