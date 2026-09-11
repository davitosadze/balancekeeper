import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { COLORS } from '@/utils/constants';

const PIECE_COUNT = 24;
const COLOR_KEYS = Object.keys(COLORS) as (keyof typeof COLORS)[];
const DURATION_MS = 1400;

interface Piece {
  x: number;
  delay: number;
  drift: number;
  color: string;
  rotations: number;
  width: number;
  height: number;
}

/**
 * One-shot confetti burst for the level-complete celebration: a handful of
 * colored rectangles falling from the top with drift and rotation, fading
 * out near the end. Mount this component only while the celebration should
 * play; it does not loop or remove itself.
 */
export default function Confetti() {
  const { width } = useWindowDimensions();

  const pieces: Piece[] = React.useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        x: (i / PIECE_COUNT) * width + ((i * 37) % 40) - 20,
        delay: (i % 6) * 60,
        drift: ((i * 53) % 80) - 40,
        color: COLORS[COLOR_KEYS[i % COLOR_KEYS.length]],
        rotations: 2 + (i % 3),
        width: 6 + (i % 3) * 2,
        height: 10 + (i % 2) * 4,
      })),
    [width]
  );

  return (
    <>
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} />
      ))}
    </>
  );
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: DURATION_MS, easing: Easing.in(Easing.quad) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: piece.x + piece.drift * progress.value },
      { translateY: -40 + progress.value * 520 },
      { rotate: `${progress.value * piece.rotations * 360}deg` },
    ],
    opacity: progress.value > 0.8 ? (1 - progress.value) * 5 : 1,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        { width: piece.width, height: piece.height, backgroundColor: piece.color },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 2,
  },
});
