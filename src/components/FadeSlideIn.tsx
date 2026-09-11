import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing } from 'react-native-reanimated';

export interface FadeSlideInProps {
  children: React.ReactNode;
  /** Delay (ms) before the animation starts — stagger a list by passing index * step. */
  delay?: number;
  /** Vertical distance (px) traveled while fading in. */
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fades and slides its children up into place on mount. The single building
 * block for "staggered entrance" animations across the menu, level-select
 * grid, and level-complete summary — pass an incrementing `delay` to stagger
 * a list.
 */
export default function FadeSlideIn({ children, delay = 0, distance = 16, duration = 380, style }: FadeSlideInProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
