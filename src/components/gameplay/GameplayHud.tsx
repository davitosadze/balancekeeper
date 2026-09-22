import React, { useEffect, memo } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { GAME_FONT } from './assets';
import WoodTexture from './WoodTexture';

export function GlassPanel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <LinearGradient colors={['rgba(55,46,35,.79)', 'rgba(38,29,21,.83)']} style={[styles.glass, style]}>{children}</LinearGradient>;
}

export function ProgressBar({ value, tone = 'gold', height = 8 }: { value: number; tone?: 'gold' | 'green' | 'gray' | 'red'; height?: number }) {
  const reduced = useReducedMotionPreference();
  const progress = useSharedValue(Math.max(0, Math.min(1, value)));
  useEffect(() => { progress.value = withTiming(Math.max(0, Math.min(1, value)), { duration: reduced ? 0 : 200 }); return () => cancelAnimation(progress); }, [value, progress, reduced]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{scaleX:progress.value}] }));
  const colors: [string, string] = tone === 'red' ? ['#ee9b77', '#c9503e'] : tone === 'green' ? ['#b4d885', '#7d9f50'] : tone === 'gray' ? ['#797063', '#554d42'] : ['#ffe293', '#dda343'];
  return <View style={[styles.track, { height, borderRadius: height }]}>
    <Animated.View style={[{ width:'100%', height: '100%', overflow: 'hidden', borderRadius: height, transformOrigin:'left' }, fillStyle]}>
      <LinearGradient colors={colors} style={{ flex: 1, borderTopWidth: .5, borderTopColor: 'rgba(255,249,218,.5)' }} />
    </Animated.View>
  </View>;
}

export const TopHud = memo(function TopHud({ level, coins, progress, stars, scale, onPause, onCoins }: { level: number; coins: number; progress: number; stars: number; scale: number; onPause: () => void; onCoins: () => void }) {
  const s = Math.min(1.1, Math.max(.85, scale));
  return <View testID="gameplay-hud" style={styles.hud}>
    <Pressable onPress={onPause} accessibilityRole="button" accessibilityLabel="Pause" style={({ pressed }) => [styles.pause, pressed && styles.pressed]}>
      <LinearGradient colors={['#8b5830', '#4d2b15', '#301a0c']} style={styles.pauseFace}>
        <View pointerEvents="none" style={styles.innerFrame} /><View style={styles.pauseBar} /><View style={styles.pauseBar} />
      </LinearGradient>
    </Pressable>
    <LinearGradient colors={['#88562c', '#5e3519', '#40210d']} style={styles.levelGroup}>
      <WoodTexture opacity={.3} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.text, { fontSize: 17 * s, flexShrink: 1 }]}>Level {level}</Text>
      <View accessibilityLabel={`${stars} of 3 stars earned, ${Math.round(progress * 100)} percent complete`} style={styles.stars}>
        {[1, 2, 3].map(n => <Text key={n} style={{ fontSize: 23 * s, color: n <= stars ? '#ffd16b' : '#2d170a', textShadowColor: n <= stars ? '#b97719' : '#a46a39', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}>★</Text>)}
      </View>
    </LinearGradient>
    <Pressable onPress={onCoins} accessibilityRole="button" accessibilityLabel={`Coin information, ${coins} coins`} style={({ pressed }) => [styles.coins, pressed && styles.pressed]}>
      <LinearGradient colors={['#684324', '#39210f']} style={styles.coinPanel}>
        <LinearGradient colors={['#ffe99b', '#e9ac39', '#b67a24']} style={styles.coin}><View style={styles.coinStamp} /></LinearGradient>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.text, { fontSize: 15 * s, flexShrink: 1 }]}>{coins.toLocaleString()}</Text>
        <View style={styles.plus}><View style={styles.plusLine} /><View style={[styles.plusLine, { transform: [{ rotate: '90deg' }] }]} /></View>
      </LinearGradient>
    </Pressable>
  </View>;
});
const styles = StyleSheet.create({
  glass: { borderWidth: 1, borderColor: 'rgba(244,222,183,.32)', shadowColor: '#241509', shadowOffset: { width: 0, height: 3 }, shadowOpacity: .22, shadowRadius: 5 },
  hud: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 },
  text: { color: '#fff3df', fontFamily: GAME_FONT, fontWeight: '600', fontVariant: ['tabular-nums'] },
  levelGroup: { flex: 1, minWidth: 0, height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#a77542', borderTopColor: '#bf8a50', borderBottomWidth: 2, shadowColor: '#140c05', shadowOpacity: .5, shadowRadius: 3, shadowOffset: { width: 0, height: 3 } },
  pause: { width: 42, height: 44 },
  pauseFace: { flex: 1, borderRadius: 12, borderWidth: 2, borderTopColor: '#b78b5d', borderColor: '#78512e', borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  innerFrame: { position: 'absolute', inset: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(225,173,106,.15)' },
  pauseBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#fff0d7' },
  track: { backgroundColor: 'rgba(26,18,12,.58)', borderWidth: .5, borderColor: 'rgba(248,223,185,.2)', overflow: 'hidden' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 0, marginLeft: 4 },
  coins: { height: 44, maxWidth: 121, flexShrink: 1 },
  coinPanel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6, borderRadius: 11, borderWidth: 1.5, borderColor: '#94693f', borderTopColor: '#c09965', borderBottomWidth: 3 },
  coin: { width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f7d780' },
  coinStamp: { width: 13, height: 13, borderRadius: 7, borderWidth: 1, borderColor: '#b6822e' },
  plus: { width: 22, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(218,174,107,.24)', borderWidth: .5, borderColor: 'rgba(249,218,171,.32)' },
  plusLine: { position: 'absolute', width: 10, height: 2, borderRadius: 1, backgroundColor: '#fce8c6' },
  pressed: { opacity: .75, transform: [{ scale: .96 }] },
});
