import React from 'react';
import { Image, View, Text, Pressable, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GAME_FONT } from '../gameplay/assets';
import { CoinBalance } from './ScreenHeader';
import type { ButtonProps } from './Button';

export const WOODLAND = { cream: '#fff0d0', muted: '#d6bea0', gold: '#ffdc78' };
export function WoodlandBackdrop({ room = false, dark = false }: { room?: boolean; dark?: boolean }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Image source={room ? require('../../../assets/runtime/main-bg.webp') : require('../../../assets/levels/forest.webp')} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
    <LinearGradient colors={dark ? ['rgba(14,10,8,.90)', 'rgba(20,13,9,.60)', 'rgba(17,10,5,.30)'] : ['rgba(13,19,12,.62)', 'rgba(24,19,10,.23)', 'rgba(19,11,5,.42)']} style={StyleSheet.absoluteFill} />
  </View>;
}
export function WoodGrain() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 16 }]}>
    {[8, 19, 32, 48, 65, 79, 92].map((top, i) => <View key={top} style={{ position: 'absolute', top: `${top}%`, left: i % 2 ? -20 : 12, right: i % 2 ? 8 : -10, height: 2, borderRadius: 30, borderTopWidth: 1, borderTopColor: 'rgba(239,174,98,.08)', backgroundColor: 'rgba(28,12,3,.16)', transform: [{ rotate: i % 2 ? '-1deg' : '1deg' }] }} />)}
  </View>;
}
export function WoodPanel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <LinearGradient colors={['#654226', '#422819', '#302015']} style={[styles.panel, style]}>
    <WoodGrain /><View pointerEvents="none" style={styles.inset} />{children}
  </LinearGradient>;
}
export function WoodHeader({ title, onBack, coins = false, balanceTestID, backLabel = 'Back to main menu' }: { title: string; onBack: () => void; coins?: boolean; balanceTestID?: string; backLabel?: string }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={({ pressed }) => [styles.back, pressed && { transform: [{ scale: .95 }] }]}>
      <LinearGradient colors={['#a77247', '#65371c']} style={styles.backFace}><Text style={styles.arrow}>➜</Text></LinearGradient>
    </Pressable>
    <View style={styles.signWrap}>
      {[16, 82].map(left => <View key={left} style={[styles.rope, { left: `${left}%` }]} />)}
      <WoodPanel style={styles.sign}><Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.title}>{title.toUpperCase()}</Text></WoodPanel>
    </View>
    {coins ? <View style={styles.wallet}><CoinBalance testID={balanceTestID} /></View> : <View style={{ width: 30 }} />}
  </View>;
}
export function WoodButton({ label, onPress, variant = 'primary', disabled = false, style, accessibilityLabel }: ButtonProps) {
  const colors: [string, string, string] = variant === 'primary' ? ['#9bd65c', '#4a9b35', '#226222'] : variant === 'accent' ? ['#ffe275', '#ffc03c', '#e69513'] : variant === 'danger' ? ['#cf6343', '#9e3826', '#66251c'] : ['#a4714d', '#74462c', '#4a2b19'];
  const border = variant === 'primary' ? '#b9e789' : variant === 'accent' ? '#fff0a2' : '#c28b60';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, style, disabled && { opacity: .5 }, pressed && { transform: [{ translateY: 3 }, { scale: .98 }] }]}>
    <LinearGradient colors={colors} style={[styles.buttonFace, { borderColor: border }]}>
      <View pointerEvents="none" style={[styles.inset, { borderColor: 'rgba(255,239,194,.26)' }]} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.buttonLabel, variant === 'accent' && { color: '#58330c', textShadowColor: '#ffe594' }]}>{label}</Text>
    </LinearGradient>
  </Pressable>;
}
export function Ribbon({ title }: { title: string }) {
  const { width } = useWindowDimensions();
  return <View style={styles.ribbonWrap}>
    <View style={[styles.ribbonTail, { left: -9, transform: [{ rotate: '-12deg' }] }]} /><View style={[styles.ribbonTail, { right: -9, transform: [{ rotate: '12deg' }] }]} />
    <LinearGradient colors={['#d76638', '#bd3e22', '#942a18']} style={styles.ribbon}>
      <View style={styles.ribbonInset} /><Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={[styles.ribbonTitle, { fontSize: Math.min(27, (width - 64) * .079) }]}>{title}</Text>
    </LinearGradient>
    {[styles.leafLeft, styles.leafRight].map((position, i) => <View key={i} style={[styles.leaf, position]} />)}
  </View>;
}
export function Encouragement({ success = false }: { success?: boolean }) {
  if (!success) return <Image accessibilityLabel="Small Moves, Big Balance" source={require('../../../assets/runtime/tagline-board.webp')} resizeMode="contain" style={styles.tagline} />;
  return <View style={styles.encouragement}><View style={[styles.rope, { left: '12%', top: -24, height: 30 }]} /><View style={[styles.rope, { right: '12%', top: -24, height: 30 }]} /><WoodPanel style={styles.messageBoard}><Text style={styles.message}>{'Great thinking!\nOn to the next level!\n♡'}</Text></WoodPanel></View>;
}
const styles = StyleSheet.create({
  panel: { borderRadius: 20, borderWidth: 2, borderTopColor: '#b1834e', borderColor: '#88572e', borderBottomWidth: 4, borderBottomColor: '#4d2b13', shadowColor: '#140a03', shadowOpacity: .65, shadowRadius: 5, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  inset: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderColor: 'rgba(221,167,99,.25)', borderRadius: 15 },
  header: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 45, height: 49 }, backFace: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#bc8e5d', borderBottomWidth: 4, borderBottomColor: '#4a2a15', alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 29, lineHeight: 35, color: WOODLAND.cream, transform: [{ rotate: '180deg' }] },
  signWrap: { flex: 1, minWidth: 90 }, sign: { minHeight: 62, justifyContent: 'center', alignItems: 'center', borderRadius: 11, paddingHorizontal: 10 },
  rope: { position: 'absolute', top: -80, height: 90, width: 4, backgroundColor: '#53331b', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#a57744' },
  title: { fontFamily: GAME_FONT, fontSize: 26, fontWeight: '800', color: WOODLAND.cream, textShadowColor: '#291305', textShadowRadius: 2, textShadowOffset: { width: 0, height: 2 } },
  wallet: { borderRadius: 22, paddingHorizontal: 8, maxWidth: 106, borderWidth: 1, borderColor: '#746641', backgroundColor: 'rgba(18,26,18,.9)' },
  button: { borderRadius: 17, shadowColor: '#1d0d04', shadowOpacity: .6, shadowRadius: 4, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  buttonFace: { minHeight: 62, paddingHorizontal: 13, paddingVertical: 14, borderWidth: 2, borderBottomWidth: 5, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontFamily: GAME_FONT, fontWeight: '700', fontSize: 18, color: WOODLAND.cream, textShadowColor: 'rgba(42,20,6,.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  ribbonWrap: { width: '100%', marginTop: 12, marginBottom: 4, height: 82, justifyContent: 'center' },
  ribbon: { height: 78, borderRadius: 13, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 2, borderTopColor: '#f4a268', borderColor: '#8a2916', borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, transform: [{ rotate: '-2deg' }], shadowColor: '#210c05', shadowOpacity: .8, shadowRadius: 5, shadowOffset: { width: 0, height: 5 } },
  ribbonInset: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 4, borderRadius: 10, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: 1, borderColor: 'rgba(255,172,104,.25)' },
  ribbonTitle: { color: '#fff0cf', fontFamily: GAME_FONT, fontSize: 27, fontWeight: '700', textShadowColor: '#651d10', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 2 },
  ribbonTail: { position: 'absolute', top: 24, width: 40, height: 65, backgroundColor: '#942816', borderBottomWidth: 6, borderColor: '#6d1e11' },
  leaf: { position: 'absolute', width: 25, height: 13, borderTopLeftRadius: 22, borderBottomRightRadius: 22, backgroundColor: '#7a8b2a', borderTopWidth: 2, borderColor: '#b1ad44' },
  leafLeft: { top: -4, left: 14, transform: [{ rotate: '-32deg' }] }, leafRight: { top: 0, right: 17, transform: [{ rotate: '56deg' }] },
  tagline: { width: 235, height: 115, alignSelf: 'center', marginTop: 12 },
  encouragement: { width: 245, alignSelf: 'center', marginTop: 22, marginBottom: 4, transform: [{ rotate: '-3deg' }] },
  messageBoard: { padding: 10, backgroundColor: '#936332' },
  message: { fontFamily: GAME_FONT, fontSize: 16, lineHeight: 22, fontWeight: '600', textAlign: 'center', color: '#f6d8a6' },
});
