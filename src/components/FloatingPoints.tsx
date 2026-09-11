import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import type { FloatingPointEvent } from '@/types/game';
import { TUBE_COUNT, FLOATING_POINT_DURATION_MS } from '@/utils/constants';

export interface FloatingPointsProps {
  events: FloatingPointEvent[];
  boardWidth: number;
  onDismiss: (id: string) => void;
}

/**
 * Renders every active floating "+N PTS" popup, each rising and fading out
 * above the tube that earned it, then dismissing itself from the store.
 */
export default function FloatingPoints({ events, boardWidth, onDismiss }: FloatingPointsProps) {
  if (boardWidth === 0) return null;

  return (
    <>
      {events.map((event) => (
        <FloatingPoint
          key={event.id}
          event={event}
          x={(boardWidth / TUBE_COUNT) * (event.tubeIndex + 0.5)}
          onDismiss={onDismiss}
        />
      ))}
    </>
  );
}

function FloatingPoint({
  event,
  x,
  onDismiss,
}: {
  event: FloatingPointEvent;
  x: number;
  onDismiss: (id: string) => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: FLOATING_POINT_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onDismiss)(event.id);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -40 * progress.value }, { scale: 0.85 + 0.3 * Math.sin(progress.value * Math.PI) }],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { left: x - 60 }, style]}>
      <Text style={styles.amount}>+{event.amount.toLocaleString()}</Text>
      <Text style={styles.label}>{event.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 20,
    width: 120,
    alignItems: 'center',
  },
  amount: {
    color: '#6ee7b7',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(16, 185, 129, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  label: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
