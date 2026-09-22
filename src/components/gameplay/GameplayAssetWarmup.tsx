import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { getActiveGameplayAssets } from '@/assets/cosmetics';
import { prepareGameplayAssets } from '@/assets/preload';
import { useEquippedCosmetic } from '@/hooks/useCosmetics';

/** Only the equipped set. Mounted native images prime decoded surfaces as well as disk cache. */
function GameplayAssetWarmup({ onReady, onError }: { onReady: (ready: boolean) => void; onError: () => void }) {
  const background = useEquippedCosmetic('background'), bottle = useEquippedCosmetic('bottle');
  const sources = useMemo(() => getActiveGameplayAssets(background,bottle),[background,bottle]);
  const [loaded,setLoaded] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    let active = true; onReady(false); setLoaded(new Set());
    void prepareGameplayAssets(background,bottle).then(() => {
      if(active && Platform.OS === 'web') onReady(true);
    }).catch(() => { if(active) onError(); });
    return () => { active = false; };
  },[background,bottle,onReady,onError]);
  useEffect(() => { if(Platform.OS !== 'web' && loaded.size === sources.length) onReady(true); },[loaded,sources,onReady]);
  if(Platform.OS === 'web') return null;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',width:1,height:1,overflow:'hidden',opacity:.001}}>
    {sources.map((source,index) => <Image key={`${background}:${bottle}:${index}`} source={source} fadeDuration={0} style={{width:320,height:480}} onLoad={() => setLoaded(previous => new Set(previous).add(index))} onError={onError} />)}
  </View>;
}
export default memo(GameplayAssetWarmup);
