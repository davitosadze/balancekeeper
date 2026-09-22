import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { rewardedAds, rewardedAdsSupported } from '@/services/ads/rewardedAds';
import type { RewardRequest, ShowResult } from '@/services/ads/rewardedController';

/** The route owns each request. Blur invalidates callbacks even when the route stays mounted. */
export function useRewardedAd() {
  const status = useSyncExternalStore(rewardedAds.subscribe, rewardedAds.getSnapshot, rewardedAds.getSnapshot);
  const owner = useRef({});
  const focused = useRef(false);
  const focusGeneration = useRef(0);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (rewardedAdsSupported) void rewardedAds.preload();
    return () => {
      focused.current = false;
      ++focusGeneration.current;
      rewardedAds.cancel(owner.current);
    };
  }, []));
  const show = useCallback((request: Omit<RewardRequest, 'owner'>): Promise<ShowResult> => {
    const generation = focusGeneration.current;
    return rewardedAds.show({ ...request, owner: owner.current,
      isValid: () => focused.current && generation === focusGeneration.current && request.isValid(),
    });
  }, []);
  return { status, supported: rewardedAdsSupported, show };
}
