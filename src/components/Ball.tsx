import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BallColor } from '@/types/game';
import { COLORS, BALL_GRADIENT_SHADES, BALL_SLOT_PITCH, FONTS, getBallSize } from '@/utils/constants';

export interface BallProps {
  color: BallColor;
  /** Weight in kg, printed on the ball; also drives its render size. */
  weight: number;
  /** Vertical slot position (0 = bottom of tube) used for absolute layout inside a bottle. Omit to render inline (e.g. in the tray). */
  position?: number;
  /** Slot pitch (px) between stacked balls; defaults to the standard in-tube spacing. */
  spacing?: number;
  /** Ring highlight shown while this ball is selected in the tray. */
  selected?: boolean;
}

/**
 * Renders a single ball as a clean flat-shaded sphere: a simple two-tone
 * gradient fill and one soft highlight, colored per the game palette and
 * sized by weight. The "Xkg" label only shows in the tray (position
 * omitted) — once a ball is placed inside a bottle the label is dropped so
 * the stack reads cleanly and the bottle's own weight badge is the single
 * source of truth for the number.
 */
export default function Ball({ color, weight, position, spacing = BALL_SLOT_PITCH, selected = false }: BallProps) {
  const size = getBallSize(weight);
  const shades = BALL_GRADIENT_SHADES[color];
  const positioned = position !== undefined;

  return (
    <View
      accessible
      accessibilityLabel={`${weight} kilogram ball${selected ? ', selected' : ''}`}
      style={[
        positioned ? styles.wrapperPositioned : styles.wrapperInline,
        {
          width: size,
          height: size,
          bottom: positioned ? position * spacing + 4 : undefined,
        },
      ]}
    >
      {selected && (
        <View
          style={[
            styles.selectionRing,
            { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, left: -4, top: -4 },
          ]}
        />
      )}
      <LinearGradient
        colors={[shades.light, COLORS[color]]}
        start={{ x: 0.3, y: 0.15 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={[styles.highlight, { width: size * 0.4, height: size * 0.3, borderRadius: size * 0.2 }]} />
        {!positioned && <Text style={[styles.label, { fontSize: size * 0.32 }]}>{weight}kg</Text>}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapperPositioned: {
    position: 'absolute',
    alignSelf: 'center',
  },
  wrapperInline: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionRing: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  ball: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  highlight: {
    position: 'absolute',
    top: '14%',
    left: '16%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: FONTS.displayBold,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
