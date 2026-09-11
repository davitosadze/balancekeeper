import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { Tube as TubeType } from '@/types/game';
import { bottleWeight } from '@/utils/physics';
import { UI_COLORS, BOTTLE_GEOMETRY, PEDESTAL_TONES, FONTS, getBallSize } from '@/utils/constants';
import Ball from './Ball';

export interface TubeProps {
  tubes: TubeType[];
  index: number;
  /** Highlighted as a valid drop target for the currently selected/dragged tray ball. */
  isSelected: boolean;
  isComplete: boolean;
  onPress: (index: number) => void;
  /** Timestamp of an invalid placement attempt into this bottle; re-triggers the shake each time it changes. */
  shakeAt?: number;
  /** Locked-bottle gimmick: renders a padlock overlay and ignores taps. */
  locked?: boolean;
}

const BOUNCE_SPRING = { damping: 8, stiffness: 260, mass: 0.5 };
const { bodyHeight: BODY_HEIGHT, bodyWidth: BODY_WIDTH, neckWidth: NECK_WIDTH, neckHeight: NECK_HEIGHT } = BOTTLE_GEOMETRY;

/**
 * Renders a single flat-shaded bottle: a rounded glass body on a wood
 * pedestal whose badge shows a live "current / target" kg readout, an
 * impact bounce when a ball lands, and a shake when an invalid placement is
 * attempted. Tapping (or dropping a dragged tray ball on) it invokes onPress
 * so the parent can try placing the selected ball here.
 */
export default function Tube({ tubes, index, isSelected, isComplete, onPress, shakeAt, locked = false }: TubeProps) {
  const tube = tubes[index];
  const weight = bottleWeight(tube);

  const bounceY = useSharedValue(0);
  const bounceScale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  const ballCount = tube.balls.length;
  const topBallWeight = tube.balls[tube.balls.length - 1]?.weight ?? 0;
  const prevBallCount = useRef(ballCount);
  useEffect(() => {
    if (ballCount > prevBallCount.current) {
      const kick = Math.min(12, 4 + topBallWeight);
      bounceY.value = withSequence(withSpring(kick, BOUNCE_SPRING), withSpring(0, BOUNCE_SPRING));
      bounceScale.value = withSequence(
        withSpring(1.04 + Math.min(0.06, topBallWeight * 0.01), BOUNCE_SPRING),
        withSpring(1, BOUNCE_SPRING)
      );
    }
    prevBallCount.current = ballCount;
  }, [ballCount, topBallWeight, bounceY, bounceScale]);

  useEffect(() => {
    if (shakeAt === undefined) return;
    shakeX.value = withSequence(
      withTiming(-8, { duration: 45, easing: Easing.linear }),
      withTiming(8, { duration: 90, easing: Easing.linear }),
      withTiming(-6, { duration: 90, easing: Easing.linear }),
      withTiming(0, { duration: 60, easing: Easing.linear })
    );
  }, [shakeAt, shakeX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: bounceY.value }, { scale: bounceScale.value }],
  }));

  const borderColor = locked
    ? 'rgba(255,255,255,0.35)'
    : isComplete
    ? UI_COLORS.complete
    : isSelected
    ? UI_COLORS.selected
    : 'rgba(255,255,255,0.4)';

  const glowStyle = locked ? undefined : isSelected ? styles.glowSelected : isComplete ? styles.glowComplete : undefined;

  return (
    <Pressable
      onPress={() => !locked && onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={
        locked ? `Bottle ${index + 1}, locked` : `Bottle ${index + 1}, ${weight} of ${tube.target} kilograms`
      }
      style={styles.wrapper}
    >
      {isSelected && <Text style={styles.selectedTag}>Drop here</Text>}

      <Animated.View style={[styles.bottleGroup, animatedStyle]}>
        <View style={[styles.neck, { borderColor }]} />
        <View style={[styles.body, { borderColor }, glowStyle]}>
          <View style={styles.glassFill} />
          <View style={styles.sheen} />
          {tube.balls.map((ball, i) => (
            <Ball key={ball.id} color={ball.color} weight={ball.weight} position={i} spacing={getBallSize(ball.weight) - 4} />
          ))}
          {locked && (
            <View style={styles.lockOverlay}>
              <View style={styles.padlockBadge}>
                <Text style={styles.padlockEmoji}>🔒</Text>
                <Text style={styles.lockedLabel}>Locked</Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      <LinearGradient colors={PEDESTAL_TONES.gradient} style={styles.pedestal}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{locked ? `0 / ${tube.target}` : `${weight} / ${tube.target}`}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  selectedTag: {
    color: UI_COLORS.selected,
    fontSize: 10,
    fontFamily: FONTS.displayBold,
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottleGroup: {
    alignItems: 'center',
  },
  neck: {
    width: NECK_WIDTH,
    height: NECK_HEIGHT,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  body: {
    width: BODY_WIDTH,
    height: BODY_HEIGHT,
    borderWidth: 2,
    borderRadius: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  glassFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheen: {
    position: 'absolute',
    top: 8,
    left: 10,
    bottom: 12,
    width: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  glowSelected: {
    shadowColor: UI_COLORS.selected,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 12,
  },
  glowComplete: {
    shadowColor: UI_COLORS.complete,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(71, 85, 105, 0.25)',
  },
  padlockBadge: {
    width: 52,
    height: BODY_HEIGHT * 0.4,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  padlockEmoji: {
    fontSize: 20,
  },
  lockedLabel: {
    color: '#f1f5f9',
    fontSize: 10,
    fontFamily: FONTS.displaySemiBold,
  },
  pedestal: {
    marginTop: 4,
    width: BODY_WIDTH + 8,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  badge: {
    backgroundColor: PEDESTAL_TONES.badgeBg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: PEDESTAL_TONES.badgeText,
    fontSize: 12,
    fontFamily: FONTS.displayBold,
  },
});
