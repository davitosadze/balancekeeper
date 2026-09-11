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
        <View style={[styles.neck, { borderColor }]}>
          <View style={styles.neckGlass} />
          <View style={styles.rim} />
        </View>
        <View style={[styles.body, { borderColor }, glowStyle]}>
          <LinearGradient colors={['rgba(238, 251, 255, 0.44)', 'rgba(116, 191, 211, 0.12)', 'rgba(10, 61, 82, 0.24)']} style={styles.glassFill} />
          <View style={styles.shoulderLine} />
          <View style={styles.liquidReflection} />
          <View style={styles.sheen} />
          <View style={styles.rightReflection} />
          {tube.balls.map((ball, i) => (
            <Ball key={ball.id} color={ball.color} weight={ball.weight} position={i} spacing={getBallSize(ball.weight) - 4} />
          ))}
          {locked && (
            <View style={styles.lockOverlay}>
              <View style={styles.padlockBadge}>
                <View style={styles.lockIcon}>
                  <View style={styles.lockShackle} />
                  <View style={styles.lockBody} />
                </View>
                <Text style={styles.lockedLabel}>Locked</Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      <View style={styles.baseShadow} />
      <LinearGradient colors={PEDESTAL_TONES.gradient} style={styles.pedestal}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>WEIGHT</Text>
          <Text style={styles.badgeText}>{locked ? `0 / ${tube.target}` : `${weight} / ${tube.target}`}<Text style={styles.badgeUnit}> KG</Text></Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
  },
  selectedTag: {
    color: UI_COLORS.selected,
    fontSize: 9,
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
    paddingHorizontal: 7,
  },
  neck: {
    width: NECK_WIDTH,
    height: NECK_HEIGHT,
    borderWidth: 2.5,
    borderBottomWidth: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(174, 225, 236, 0.28)',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neckGlass: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
  },
  rim: {
    position: 'absolute',
    top: -5,
    width: NECK_WIDTH + 7,
    height: 8,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(235, 252, 255, 0.82)',
    backgroundColor: 'rgba(123, 196, 214, 0.45)',
  },
  body: {
    width: BODY_WIDTH + 8,
    height: BODY_HEIGHT,
    borderWidth: 2.5,
    borderRadius: 26,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  glassFill: {
    ...StyleSheet.absoluteFill,
  },
  shoulderLine: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    height: 1,
    backgroundColor: 'rgba(236, 253, 255, 0.38)',
  },
  liquidReflection: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,
    height: 38,
    borderRadius: 16,
    backgroundColor: 'rgba(18, 95, 119, 0.16)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  sheen: {
    position: 'absolute',
    top: 13,
    left: 9,
    bottom: 16,
    width: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  rightReflection: {
    position: 'absolute',
    top: 28,
    right: 8,
    width: 3,
    height: 34,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
  lockIcon: {
    width: 22,
    height: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  lockShackle: {
    width: 13,
    height: 11,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#f1f5f9',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  lockBody: {
    width: 20,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#f1f5f9',
  },
  lockedLabel: {
    color: '#f1f5f9',
    fontSize: 10,
    fontFamily: FONTS.displaySemiBold,
  },
  pedestal: {
    marginTop: 10,
    width: BODY_WIDTH + 14,
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(57, 30, 14, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  badge: {
    minWidth: BODY_WIDTH - 8,
    backgroundColor: 'rgba(8, 28, 39, 0.94)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(117, 226, 224, 0.28)',
  },
  badgeLabel: {
    color: '#7fa4ae',
    fontSize: 7,
    letterSpacing: 1.4,
    lineHeight: 9,
    fontFamily: FONTS.displaySemiBold,
  },
  badgeText: {
    color: '#d6fffa',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.4,
    fontFamily: FONTS.displayBold,
  },
  badgeUnit: {
    color: '#73d6d1',
    fontSize: 9,
    fontFamily: FONTS.displaySemiBold,
  },
  baseShadow: {
    position: 'absolute',
    bottom: 0,
    width: BODY_WIDTH + 26,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(30, 35, 26, 0.38)',
    transform: [{ translateY: 4 }],
  },
});
