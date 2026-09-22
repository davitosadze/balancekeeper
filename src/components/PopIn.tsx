import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated';

export interface PopInProps {
  children: React.ReactNode;
  /** Delay (ms) before the pop starts — stagger a row of icons/stars by passing index * step. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const POP_SPRING = { damping: 9, stiffness: 200, mass: 0.6 };

/**
 * Scales its children in from nothing with a springy overshoot — the classic
 * "star reveal" pop. Used for the level-complete star rating and other
 * one-at-a-time reveal moments.
 */
export default function PopIn({ children, delay = 0, style }: PopInProps) {
  const reduced = useReducedMotionPreference();
  const scale = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if(reduced) { scale.value = 1; return; }
    scale.value = withDelay(delay, withSpring(1, POP_SPRING));
    return () => cancelAnimation(scale);
  }, [reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
