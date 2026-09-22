import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withRepeat, withSequence, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { GAME_FONT } from '../gameplay/assets';
import { GlassPanel, ProgressBar } from '../gameplay/GameplayHud';

const CREAM = '#ffedce';
export type MenuIconName = 'profile' | 'settings' | 'levels' | 'guide' | 'play' | 'shop';

/** Small UI icons use native shapes; the scene artwork remains supplied imagery. */
export function MenuIcon({ name, size = 24 }: { name: MenuIconName; size?: number }) {
  if (name === 'shop') return <View style={{width:size,height:size,alignItems:'center',justifyContent:'flex-end'}}><View style={{position:'absolute',top:0,width:size*.45,height:size*.45,borderWidth:2,borderColor:CREAM,borderRadius:5}}/><View style={{width:size*.8,height:size*.7,borderWidth:2,borderColor:CREAM,borderRadius:4}}/></View>;
  if (name === 'profile') return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
    <View style={{ position: 'absolute', top: 0, width: size * .4, height: size * .4, borderRadius: size, backgroundColor: CREAM }} />
    <View style={{ width: size * .72, height: size * .42, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: CREAM }} />
  </View>;
  if (name === 'play') return <View style={{ borderLeftWidth: size * .76, borderTopWidth: size * .48, borderBottomWidth: size * .48, borderLeftColor: '#633006', borderTopColor: 'transparent', borderBottomColor: 'transparent', marginLeft: size * .15 }} />;
  if (name === 'levels') return <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: size * .1 }}>{[0, 1, 2, 3].map(i => <View key={i} style={{ width: size * .44, height: size * .44, borderRadius: size * .09, backgroundColor: CREAM }} />)}</View>;
  if (name === 'guide') return <View style={{ width: size, height: size * .9, flexDirection: 'row', gap: 2 }}>
    {[0, 1].map(i => <View key={i} style={{ flex: 1, borderWidth: 2, borderColor: CREAM, borderTopLeftRadius: i === 0 ? 4 : 0, borderTopRightRadius: i === 1 ? 4 : 0, paddingTop: 5, gap: 4 }}>{[0, 1].map(j => <View key={j} style={{ height: 1, marginHorizontal: 2, backgroundColor: CREAM }} />)}</View>)}
  </View>;
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {[0, 45, 90, 135].map(angle => <View key={angle} style={{ position: 'absolute', width: size * .22, height: size, borderRadius: size * .06, backgroundColor: CREAM, transform: [{ rotate: `${angle}deg` }] }} />)}
    <View style={{ width: size * .77, height: size * .77, borderRadius: size, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: size * .36, height: size * .36, borderRadius: size, backgroundColor: '#715038' }} /></View>
  </View>;
}

export function TactileButton({ children, onPress, label, style, disabled = false, onPressedChange }: { children: React.ReactNode; onPress: () => void; label: string; style?: StyleProp<ViewStyle>; disabled?: boolean; onPressedChange?: (pressed: boolean) => void }) {
  const reduced = useReducedMotionPreference();
  const pressed = useSharedValue(0);
  useEffect(() => () => cancelAnimation(pressed), [pressed]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * .045 }, { translateY: pressed.value * 2 }], opacity: 1 - pressed.value * .05 }));
  return <Animated.View style={[style, animatedStyle]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      onPressIn={() => { onPressedChange?.(true); pressed.value = reduced ? 0 : withSpring(1, { damping: 18, stiffness: 350 }); }}
      onPressOut={() => { onPressedChange?.(false); pressed.value = reduced ? 0 : withSpring(0, { damping: 12, stiffness: 260 }); }}
      style={{ width: '100%', height: '100%' }}>{children}</Pressable>
  </Animated.View>;
}

export function MainTopHud({ level, coins, progress, scale: s, onCoins }: { level: number; coins: number; progress: number; scale: number; onCoins: () => void }) {
  return <View style={styles.hud}>
    <GlassPanel style={{ width: 151 * s, height: 45 * s, padding: 4 * s, borderRadius: 23 * s, flexDirection: 'row', alignItems: 'center', gap: 9 * s }}>
      <View style={[styles.avatar, { width: 35 * s, height: 35 * s, borderRadius: 20 * s }]}><MenuIcon name="profile" size={23 * s} /></View>
      <View style={{ flex: 1, gap: 2 * s, paddingRight: 7 * s }}>
        <Text style={[styles.text, { fontSize: 10 * s }]}>Player</Text>
        <Text style={[styles.text, { fontSize: 11 * s, color: '#f2d5ac', fontWeight: '500' }]}>Level {level}</Text>
        <ProgressBar value={progress} height={6 * s} />
      </View>
    </GlassPanel>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 * s }}>
      <GlassPanel style={{ flexDirection: 'row', alignItems: 'center', height: 35 * s, borderRadius: 20 * s, paddingHorizontal: 6 * s, gap: 7 * s }}>
        <LinearGradient colors={['#ffed82', '#ffbe19', '#e99208']} style={[styles.coin, { width: 24 * s, height: 24 * s, borderRadius: 13 * s }]}>
          <View style={{ width: 17 * s, height: 17 * s, borderWidth: 1, borderColor: '#e39a0b', borderRadius: 10 * s, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#d58a04', fontSize: 13 * s, textShadowColor: '#fff4ba', textShadowRadius: 1, textShadowOffset: { width: 0, height: 1 } }}>★</Text></View>
        </LinearGradient>
        <Text testID="main-coins" style={[styles.text, { fontSize: 16 * s }]}>{coins.toLocaleString()}</Text>
        <TactileButton label="Coin information" onPress={onCoins} style={{ width: 23 * s, height: 24 * s }}>
          <LinearGradient colors={['#c69b64', '#88542e']} style={[styles.plus, { borderRadius: 6 * s }]}><Text style={[styles.text, { fontSize: 25 * s, lineHeight: 26 * s }]}>+</Text></LinearGradient>
        </TactileButton>
      </GlassPanel>
    </View>
  </View>;
}

const PLAY_GRAIN = [16, 33, 52, 70, 86];
const PLAY_NAILS = [{ top: 7, left: 9 }, { top: 7, right: 9 }, { bottom: 7, left: 9 }, { bottom: 7, right: 9 }] as const;

/** Wooden sign in the same wood as the logo. Idle motion only fades the gold inner rim: scaling the button would soften its text on iOS. Stops under Reduced Motion. */
export function MainPlayButton({ width, height, onPress }: { width: number; height: number; onPress: () => void }) {
  const s = width / 210;
  const reduced = useReducedMotionPreference();
  const [pressed, setPressed] = useState(false);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduced) { breathe.value = 0; return; }
    breathe.value = withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })), -1);
    return () => cancelAnimation(breathe);
  }, [reduced, breathe]);
  const rimStyle = useAnimatedStyle(() => ({ opacity: .3 + breathe.value * .7 }));
  const badge = height * .58;
  const radius = height * .28;
  return <View style={{ width, height }}>
    <TactileButton onPressedChange={setPressed} label="Play" onPress={onPress} style={{ width, height }}>
      <View style={[styles.playOutline, { borderRadius: radius, shadowOpacity: pressed ? .3 : .55, shadowRadius: pressed ? 2 : 6, shadowOffset: { width: 0, height: pressed ? 2 : 6 }, elevation: pressed ? 2 : 8 }]}>
        <LinearGradient colors={['#bc7f49', '#95602f', '#6c4120']} start={{ x: .5, y: 0 }} end={{ x: .5, y: 1 }} style={[styles.playButton, { borderRadius: radius }]}>
          {PLAY_GRAIN.map((top, i) => <View key={top} pointerEvents="none" style={{ position: 'absolute', top: `${top}%`, left: i % 2 ? -12 : 10, right: i % 2 ? 8 : -12, height: 2, borderRadius: 2, backgroundColor: 'rgba(38,16,4,.16)', borderTopWidth: 1, borderTopColor: 'rgba(255,214,150,.1)', transform: [{ rotate: i % 2 ? '-.7deg' : '.7deg' }] }} />)}
          <View pointerEvents="none" style={[styles.playInset, { borderRadius: radius - 3 }]} />
          <Animated.View pointerEvents="none" style={[styles.playInset, styles.playRim, { borderRadius: radius - 3 }, rimStyle]} />
          {PLAY_NAILS.map((position, i) => <View key={i} pointerEvents="none" style={[styles.playNail, position]} />)}
          <View style={{ width: badge, height: badge, borderRadius: badge / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a200f', borderWidth: 2, borderColor: '#e9c37a' }}>
            <View style={{ borderLeftWidth: badge * .32, borderTopWidth: badge * .21, borderBottomWidth: badge * .21, borderLeftColor: '#ffd76a', borderTopColor: 'transparent', borderBottomColor: 'transparent', marginLeft: badge * .08 }} />
          </View>
          <Text style={[styles.text, { color: '#fff3d6', fontSize: 30 * s, fontWeight: '900', letterSpacing: 2 * s, textShadowColor: '#2e170a', textShadowOffset: { width: 0, height: 2.5 }, textShadowRadius: 0 }]}>PLAY</Text>
        </LinearGradient>
      </View>
    </TactileButton>
  </View>;
}

export function BottomMenu({ scale: s, onLevels, onGuide, onSettings, onShop }: { scale: number; onLevels: () => void; onGuide: () => void; onSettings: () => void; onShop: () => void }) {
  const items = [
    { name: 'shop' as const, label: 'Shop', action: onShop },
    { name: 'levels' as const, label: 'Levels', action: onLevels },
    { name: 'guide' as const, label: 'How to Play', action: onGuide },
    { name: 'settings' as const, label: 'Settings', action: onSettings },
  ];
  return <View style={{ flexDirection: 'row', gap: 11 * s }}>
    {items.map(item => <TactileButton key={item.name} label={item.label} onPress={item.action} style={{ width: 69 * s, height: 59 * s }}>
      <GlassPanel style={{ flex: 1, borderRadius: 16 * s, alignItems: 'center', justifyContent: 'center', gap: 6 * s }}>
        <MenuIcon name={item.name} size={20 * s} /><Text style={[styles.text, { fontSize: (item.name === 'guide' ? 10 : 12) * s }]}>{item.label}</Text>
      </GlassPanel>
    </TactileButton>)}
  </View>;
}

export function FooterMessage({ scale: s }: { scale: number }) {
  return <View style={{ alignItems: 'center', gap: 9 * s }}>
    <View style={{ width: 143 * s, height: 1, backgroundColor: 'rgba(255,232,191,.28)' }} />
    <Text style={[styles.text, { fontSize: 9 * s, lineHeight: 16 * s, letterSpacing: 2 * s, fontWeight: '500', textAlign: 'center', color: '#f4dfbd' }]}>{'A SIMPLE GAME\nFOR A MORE BALANCED YOU'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  text: { color: '#fff3dd', fontFamily: GAME_FONT, fontWeight: '600', textShadowColor: 'rgba(37,20,8,.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,24,17,.5)', borderWidth: 1, borderColor: 'rgba(235,211,171,.35)' },
  coin: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff1a3', shadowColor: '#211003', shadowOffset: { width: 0, height: 2 }, shadowOpacity: .65, shadowRadius: 1 },
  plus: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderTopColor: '#f1d09f', borderColor: '#825332', shadowColor: '#211003', shadowOffset: { width: 0, height: 2 }, shadowOpacity: .5, shadowRadius: 1 },
  playOutline: { flex: 1, borderWidth: 2.5, borderColor: '#2e170a', borderBottomWidth: 6, shadowColor: '#1d0d04' },
  playButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#deac6c' },
  playInset: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderColor: 'rgba(255,226,170,.28)' },
  playRim: { borderColor: 'rgba(255,214,140,.75)' },
  playNail: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#e8c27b', borderWidth: 1, borderColor: '#5b3416' },
});
