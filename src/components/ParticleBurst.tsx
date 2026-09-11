import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import type { FloatingPointEvent } from '@/types/game';
import { TUBE_COUNT, PARTICLE_BURST_DURATION_MS } from '@/utils/constants';

export interface ParticleBurstProps {
  /** Floating point events to burst for; only 'BOTTLE FULL' entries render a burst. */
  events: FloatingPointEvent[];
  boardWidth: number;
}

const RING_COUNT = 3;
const DOT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Renders a radiating particle-ring burst (concentric fading rings plus
 * outward-flying dots) behind a tube-completion popup. Purely decorative —
 * it shares the lifespan of the floating point event that triggered it and
 * unmounts itself; the store owns dismissing the underlying event.
 */
export default function ParticleBurst({ events, boardWidth }: ParticleBurstProps) {
  if (boardWidth === 0) return null;

  const bursts = events.filter((e) => e.label === 'BOTTLE FULL');

  return (
    <>
      {bursts.map((event) => (
        <Burst key={event.id} x={(boardWidth / TUBE_COUNT) * (event.tubeIndex + 0.5)} />
      ))}
    </>
  );
}

function Burst({ x }: { x: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: PARTICLE_BURST_DURATION_MS, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <Ring key={i} progress={progress} x={x} delay={i * 0.12} />
      ))}
      {DOT_ANGLES.map((angle) => (
        <Dot key={angle} progress={progress} x={x} angle={angle} />
      ))}
    </>
  );
}

function Ring({ progress, x, delay }: { progress: SharedValue<number>; x: number; delay: number }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (progress.value - delay) / (1 - delay)));
    const scale = 0.3 + t * 1.3;
    return {
      opacity: (1 - t) * 0.5,
      transform: [{ translateX: x }, { translateY: 20 }, { scale }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

function Dot({ progress, x, angle }: { progress: SharedValue<number>; x: number; angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * 60;
  const dy = Math.sin(rad) * 60;

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: 1 - t,
      transform: [
        { translateX: x + dx * t },
        { translateY: 20 + dy * t },
        { scale: 1 - t * 0.5 },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    marginLeft: -30,
    marginTop: -30,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
  },
  dot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 5,
    height: 5,
    marginLeft: -2.5,
    marginTop: -2.5,
    borderRadius: 2.5,
    backgroundColor: '#6ee7b7',
  },
});
