import { recordRender } from '@/utils/performance';
import { getGameplayBackground, getBackgroundThumbnail, MENU_BACKGROUND } from '@/assets/cosmetics';
import { useEquippedCosmetic } from '@/hooks/useCosmetics';
import React, { memo } from "react";
import { Image, View, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/** Cover-fit scene art. Gameplay uses the supplied indoor tabletop;
 * other screens retain their existing background. Explicit window sizing
 * also supports screens kept mounted by Expo Router on web. */
function SceneBackground({
  gameplay = false,
  tabletopY,
  backgroundId,
  thumbnail = false,
}: {
  gameplay?: boolean;
  thumbnail?: boolean;
  tabletopY?: number;
  backgroundId?: string;
}) {
  recordRender('background');
  const { width, height } = useWindowDimensions();
  const equipped = useEquippedCosmetic('background');
  const background = getGameplayBackground(backgroundId ?? equipped);
  // The supplied room/table edge is about 62% down the art. On short phones,
  // cover-crop from the bottom so measured bottle feet stay on the tabletop.
  const tableEdge = background.tableEdge;
  const overscan = gameplay && tabletopY != null
    ? Math.max(0, (height * tableEdge - tabletopY + 4) / (1 - tableEdge))
    : 0;

  return (
    <View pointerEvents="none" style={styles.container}>
      <Image
        source={
          gameplay
            ? thumbnail ? getBackgroundThumbnail(backgroundId ?? equipped) : background.source
            : MENU_BACKGROUND
        }
        fadeDuration={0}
        testID="scene-background-image"
        resizeMode="cover"
        style={{ position: "absolute", top: -overscan, left: 0, width, height: height + overscan }}
      />
      {gameplay && <LinearGradient colors={[background.overlay, "rgba(78,49,24,.035)", "rgba(78,49,24,0)"]} locations={[0, .38, .65]} style={StyleSheet.absoluteFill} />}
      {!gameplay && <LinearGradient
        colors={["rgba(91, 49, 29, 0)", "rgba(91, 49, 29, 0.22)"]}
        locations={[0.65, 1]}
        style={StyleSheet.absoluteFill}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    backgroundColor: "#8c5332",
  },
});

export default memo(SceneBackground);
