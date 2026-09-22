import React, { useEffect } from 'react';
import { Image, View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, cancelAnimation, Easing, ReduceMotion } from 'react-native-reanimated';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { LinearGradient } from 'expo-linear-gradient';
import { BottleVisual } from '../Tube';
import Ball from '../Ball';

import { MAIN_ART } from '@/assets/cosmetics';
const { background: MAIN_BACKGROUND, logo: LOGO, tagline: TAGLINE } = MAIN_ART;

export function MainBackground() {
  const { width, height } = useWindowDimensions();
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#9f6d3f' }]}>
    <Image source={MAIN_BACKGROUND} resizeMode="cover" style={{ width, height }} />
    <LinearGradient colors={['rgba(49,30,12,.06)', 'rgba(49,30,12,0)', 'rgba(37,21,10,.22)']} locations={[0, .76, 1]} style={StyleSheet.absoluteFill} />
  </View>;
}

export function GameLogo({ width }: { width: number }) {
  const y = useSharedValue(3);
  useEffect(() => { y.value = withTiming(0, { duration: 750, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }); }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}><Image accessibilityLabel="Balance Keeper" source={LOGO} resizeMode="contain" style={{ width, height: width / 2 }} /></Animated.View>;
}

export function Tagline({ width }: { width: number }) {
  return <Image accessibilityLabel="Small moves, big balance" source={TAGLINE} resizeMode="contain" style={{ width, height: width * 941 / 1672 }} />;
}

/** A ball that drops into the bottle from its neck, then settles with a small bounce. */
function DropBall({ delay, drop, children }: { delay: number; drop: number; children: React.ReactNode }) {
  const reduced = useReducedMotionPreference();
  const y = useSharedValue(reduced ? 0 : -drop);
  const alpha = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { y.value = 0; alpha.value = 1; return; }
    alpha.value = withDelay(delay, withTiming(1, { duration: 90 }));
    y.value = withDelay(delay, withSequence(
      withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }),
      withTiming(-drop * .06, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 110, easing: Easing.in(Easing.quad) }),
    ));
    return () => { cancelAnimation(y); cancelAnimation(alpha); };
  }, [delay, drop, reduced, y, alpha]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value, transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Decorative only. No game balls or player state are changed by this stack. */
export function HeroBottle({ width, height }: { width: number; height: number }) {
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withDelay(1200, withSequence(
      withTiming(.45, { duration: 1100, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }),
      withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }),
    ));
  }, [sway]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value}deg` }] }));
  const fit = Math.min(1, height * .64 / (width * 1.87));
  const drop = height * .3;
  return <Animated.View testID="main-hero" pointerEvents="none" style={[{ width, height }, style]}>
    {/* Soft shadows seat the bottle on the table. */}
    <View style={{ position: 'absolute', bottom: -width * .04, left: -width * .12, right: -width * .12, height: width * .17, borderRadius: 100, backgroundColor: 'rgba(47,25,10,.22)', shadowColor: '#2e1606', shadowOffset: { width: 4, height: 5 }, shadowOpacity: .5, shadowRadius: 10 }} />
    <View style={{ position: 'absolute', bottom: 0, left: '12%', width: '76%', height: 5, borderRadius: 100, backgroundColor: 'rgba(30,14,5,.3)', shadowColor: '#1e0e05', shadowOpacity: .5, shadowRadius: 5, shadowOffset: { width: 0, height: 1 } }} />
    <BottleVisual stage="pristine" width={width} height={height} />
    <View style={{ position: 'absolute', bottom: height * .06, left: 0, right: 0, alignItems: 'center' }}>
      <DropBall delay={850} drop={drop}><View style={{ marginBottom: -width * .09 }}><Ball color="blue" weight={2} size={width * .5 * fit} /></View></DropBall>
      <DropBall delay={550} drop={drop}><View style={{ marginBottom: -width * .1 }}><Ball color="green" weight={5} size={width * .7 * fit} /></View></DropBall>
      <DropBall delay={250} drop={drop}><Ball color="red" weight={10} size={width * .87 * fit} /></DropBall>
    </View>
    <View style={[StyleSheet.absoluteFill, { opacity: .08 }]}><BottleVisual stage="pristine" width={width} height={height} /></View>
  </Animated.View>;
}
