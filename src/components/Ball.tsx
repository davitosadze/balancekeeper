import { recordRender } from '@/utils/performance';
import { getWeightSkinStyle, WEIGHT_BALL_IMAGES, type WeightColor } from '@/assets/cosmetics';
import { useEquippedCosmetic } from '@/hooks/useCosmetics';
import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BALL_SLOT_PITCH, getBallSize } from '@/utils/constants';
import { GAME_FONT } from './gameplay/assets';

export interface BallProps {
  color: WeightColor;
  skinId?: string;
  skin?: string;
  /** Optional future premium texture. Defaults never request a raster image. */
  texture?: ImageSourcePropType;
  weight?: number;
  value?: number;
  position?: number;
  spacing?: number;
  selected?: boolean;
  dragging?: boolean;
  disabled?: boolean;
  size?: number;
  showLabel?: boolean;
}
function Ball({ skinId, skin, texture, color, weight, value, position, spacing = BALL_SLOT_PITCH,
  selected = false, dragging = false, disabled = false, size: requestedSize, showLabel = true }: BallProps) {
  recordRender('ball');
  const equipped = useEquippedCosmetic('weight');
  const kg = value ?? weight ?? 5;
  const size = requestedSize ?? getBallSize(kg);
  const appearance = getWeightSkinStyle(skinId ?? skin ?? equipped, color, kg);
  const photo = texture ?? WEIGHT_BALL_IMAGES[appearance.material];
  const tall = kg >= 15;
  // Reserve the existing heavy-ball slot/drag footprint; the visible ball is circular.
  return <View accessible accessibilityLabel={`${kg} kilogram ball${selected ? ', selected' : ''}`}
    accessibilityState={{ selected, disabled }} testID="code-ball"
    style={[styles.wrapper, { width: size, height: tall ? size * 1.3 : size, opacity: disabled ? .45 : 1 }, position !== undefined && { position: 'absolute', alignSelf: 'center', bottom: position * spacing + 4 }]}>
    {(selected || dragging) && <View style={[styles.ring, { width: size + 6, height: size + 6 }]} />}
    {photo ? (
      <View style={{ width: size, height: tall ? size * 1.3 : size, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ width: size, height: size }}>
          <Image source={photo} resizeMode="contain" style={{ width: size, height: size }} />
          {showLabel && <View pointerEvents="none" style={[styles.labelCenter, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateY: size * appearance.labelOffsetY }] }]}>
            <Text numberOfLines={1} style={[styles.label, { fontSize: size * (kg >= 10 ? .26 : .3) }]}>{kg}<Text style={{ fontSize: size * .2 }}>kg</Text></Text>
          </View>}
        </View>
      </View>
    ) : (
      <LinearGradient colors={appearance.colors} start={{x:.2,y:0}} end={{x:.8,y:1}}
        style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={styles.inner} />
        <LinearGradient colors={['rgba(255,255,235,.6)','rgba(255,255,235,0)']} style={styles.gloss} />
        {showLabel && <Text numberOfLines={1} style={[styles.label, { fontSize: size * (kg >= 10 ? .26 : .3) }]}>{kg}<Text style={{ fontSize: size * .2 }}>kg</Text></Text>}
      </LinearGradient>
    )}
  </View>;
}
export default memo(Ball);
const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'flex-end' },
  ball: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,238,202,.4)', shadowColor: '#291a0e', shadowOpacity: .23, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  inner: { position: 'absolute', inset: 3, borderRadius: 999, borderTopWidth: 1, borderBottomWidth: 2, borderTopColor: 'rgba(255,255,227,.32)', borderBottomColor: 'rgba(25,22,12,.2)' },
  gloss: { position: 'absolute', top: '7%', left: '17%', width: '57%', height: '34%', borderRadius: 999, transform: [{rotate:'-18deg'}] },
  ring: { position: 'absolute', bottom: -3, borderRadius: 999, borderWidth: 2, borderColor: '#ffd56f' },
  label: { color: '#fff7e4', fontFamily: GAME_FONT, fontWeight: '700', textShadowColor: '#35281d', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  labelCenter: { alignItems: 'center', justifyContent: 'center' },
});
