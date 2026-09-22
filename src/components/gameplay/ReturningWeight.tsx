import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import React, { useEffect } from 'react';
import Animated, { cancelAnimation, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import type { Ball as BallType } from '@/types/game';
import Ball from '../Ball';

export const RETURN_DURATION = 360;
export default function ReturningWeight({ ball, from, to, size, at }: { ball: BallType; from: { x: number; y: number }; to: { x: number; y: number }; size: number; at: number }) {
  const reduced = useReducedMotionPreference();
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = 0; progress.value = withTiming(1, { duration: reduced ? 0 : RETURN_DURATION, easing: Easing.inOut(Easing.cubic) }); return () => cancelAnimation(progress); }, [at, progress, reduced]);
  const style = useAnimatedStyle(() => ({ position: 'absolute', left:0, top:0, transform: [
    {translateX:from.x + (to.x-from.x)*progress.value - size/2},
    {translateY:from.y + (to.y-from.y)*progress.value - size*(ball.weight>=15?.65:.5) - (reduced?0:Math.sin(progress.value*Math.PI)*25)},
    {scale:reduced?1:1.05-progress.value*.05},
  ] }));
  return <Animated.View pointerEvents="none" style={style}><Ball color={ball.color} weight={ball.weight} size={size} /></Animated.View>;
}
