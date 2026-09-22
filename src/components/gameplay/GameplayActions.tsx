import React, { memo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { GAME_FONT } from './assets';
import { LinearGradient } from 'expo-linear-gradient';

export interface GameplayActionsProps {
  undo: { enabled: boolean; freeUses: number; cost: number };
  hint: { enabled: boolean; freeUses: number; cost: number };
  shuffle: { enabled: boolean; freeUses: number; cost: number };
  onUndo: () => void;
  onHint: () => void;
  onShuffle: () => void;
  disabled?: boolean;
}

/** Small code-drawn icons, following the existing game's icon components. */
function ActionIcon({ name }: { name: 'Undo' | 'Hint' | 'Shuffle' }) {
  if (name === 'Hint') return <View style={styles.icon}>
    <View style={styles.bulb} /><View style={styles.bulbStem} /><View style={styles.bulbFoot} />
  </View>;
  if (name === 'Undo') return <View style={styles.icon}>
    <View style={styles.undoArc} /><View style={styles.undoArrow} />
  </View>;
  return <View style={styles.icon}>
    <View style={[styles.shuffleLine, { top: 13, transform: [{rotate:'-33deg'}] }]} /><View style={[styles.shuffleLine, { top: 13, transform: [{rotate:'33deg'}] }]} />
    <View style={[styles.arrow, { right: 2, top: 5, transform: [{ rotate: '-45deg' }] }]} />
    <View style={[styles.arrow, { right: 2, top: 16, transform: [{ rotate: '45deg' }] }]} />
  </View>;
}
function Action({ label, count, cost, disabled, onPress }: { label: 'Undo' | 'Hint' | 'Shuffle'; count?: number; cost: number; disabled?: boolean; onPress?: () => void }) {
  const reduced = useReducedMotionPreference();
  const scale = useSharedValue(1);
  useEffect(() => () => cancelAnimation(scale), [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Pressable disabled={disabled} onPress={onPress}
    onPressIn={() => { scale.value = withTiming(reduced ? 1 : .94, { duration: reduced ? 0 : 100 }); }}
    onPressOut={() => { scale.value = withTiming(1, { duration: reduced ? 0 : 120 }); }}
    accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={count == null ? cost === 0 ? "Free" : `${cost} coins` : `${count} free uses remaining`}
    accessibilityState={{ disabled: !!disabled }} style={styles.action}>
    <Animated.View style={[styles.circle, disabled && styles.disabled, style]}>
      <LinearGradient colors={['#80512b', '#4b2a14', '#281609']} style={styles.buttonFace}>
        <View style={styles.buttonInset} /><ActionIcon name={label} />
      </LinearGradient>
      {count != null && <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>}
    </Animated.View>
    <Text style={[styles.label, disabled && { opacity: .5 }]}>{label}</Text>
    <Text style={[styles.price, disabled && { opacity: .5 }]}>{count || cost === 0 ? "Free" : `${cost} coins`}</Text>
  </Pressable>;
}
function GameplayActions({ undo, hint, shuffle, onUndo, onHint, onShuffle, disabled }: GameplayActionsProps) {
  return <View testID="gameplay-actions" style={styles.row}>
    <Action label="Undo" count={undo.freeUses || undefined} cost={undo.cost} disabled={disabled || !undo.enabled} onPress={onUndo} />
    <Action label="Hint" count={hint.freeUses || undefined} cost={hint.cost} disabled={disabled || !hint.enabled} onPress={onHint} />
    <Action label="Shuffle" cost={shuffle.cost} disabled={disabled || !shuffle.enabled} onPress={onShuffle} />
  </View>;
}

const cream = '#f8e8cc';
const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignSelf: 'center', width: '86%', maxWidth: 340 },
  action: { alignItems: 'center', gap: 6, minWidth: 64, paddingVertical: 3 },
  circle: { width: 56, height: 55, borderRadius: 16, shadowColor: '#241206', shadowOpacity: .6, shadowRadius: 4, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  buttonFace: { flex: 1, borderRadius: 16, borderWidth: 2, borderTopColor: '#d4a069', borderColor: '#8f6035', borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center' },
  buttonInset: { position: 'absolute', inset: 3, borderWidth: 1, borderColor: 'rgba(223,161,91,.26)', borderRadius: 11 },
  disabled: { opacity: .48 },
  label: { color: cream, fontSize: 12, fontFamily: GAME_FONT, fontWeight: '600', textShadowColor: '#3b2516', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  price: { color: '#e7cba3', fontSize: 10, fontFamily: GAME_FONT, marginTop: -3 },
  badge: { position: 'absolute', top: -3, right: -4, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: '#e8c78f', borderWidth: 1, borderColor: '#fff0cd', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700', fontFamily: GAME_FONT, color: '#55391f' },
  icon: { width: 28, height: 28 },
  bulb: { position: 'absolute', left: 6, top: 1, width: 16, height: 19, borderRadius: 10, borderWidth: 2, borderColor: cream },
  bulbStem: { position: 'absolute', left: 10, top: 18, width: 8, height: 5, backgroundColor: cream, borderRadius: 1 },
  bulbFoot: { position: 'absolute', left: 11, top: 25, width: 6, height: 2, backgroundColor: cream, borderRadius: 1 },
  undoArc: { position: 'absolute', left: 5, top: 7, width: 20, height: 18, borderRadius: 10, borderWidth: 2, borderLeftColor: 'transparent', borderColor: cream },
  undoArrow: { position: 'absolute', top: 4, left: 4, width: 9, height: 9, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: cream, transform: [{ rotate: '45deg' }] },
  shuffleLine: { position: 'absolute', left: 3, width: 22, height: 2, borderRadius: 1, backgroundColor: cream },
  arrow: { position: 'absolute', width: 8, height: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: cream },
});

export default memo(GameplayActions, (a,b) => a.disabled === b.disabled && a.onUndo === b.onUndo && a.onHint === b.onHint && a.onShuffle === b.onShuffle &&
  (['undo','hint','shuffle'] as const).every(key => a[key].enabled === b[key].enabled && a[key].freeUses === b[key].freeUses && a[key].cost === b[key].cost));
