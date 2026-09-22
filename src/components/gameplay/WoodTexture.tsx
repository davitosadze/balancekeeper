import React, { memo } from 'react';
import { Image, View, StyleSheet } from 'react-native';

/** The lower third of the existing tabletop art supplies real wood grain. */
export default memo(function WoodTexture({ opacity = .2 }: { opacity?: number }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
    <Image source={require('../../../assets/runtime/gameplay-bg.webp')} resizeMode="stretch" fadeDuration={0} style={[styles.grain, { opacity }]} />
  </View>;
});
const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderRadius: 12 },
  grain: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '350%' },
});
