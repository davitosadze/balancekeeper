import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_INTERSTITIAL } from '@/utils/constants';
import { INTERSTITIAL_UNIT_ID } from './config';
import { InterstitialController, type InterstitialEvent } from './interstitialController';
import { InterstitialGate, RewardedActivity } from './interstitialGate';
import { InterstitialPolicy } from './interstitialPolicy';
import { adsConsent, mobileAdsSDK, rewardedAds, rewardedAdsSupported } from './rewardedAds';

export const interstitialAds = new InterstitialController({
  initialize: async () => rewardedAdsSupported && adsConsent.initialize(),
  create: () => {
    const { InterstitialAd, AdEventType } = mobileAdsSDK();
    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID);
    const events = {
      loaded: AdEventType.LOADED,
      opened: AdEventType.OPENED,
      closed: AdEventType.CLOSED,
      error: AdEventType.ERROR,
    };
    return {
      listen: (event: InterstitialEvent, listener: () => void) => ad.addAdEventListener(events[event], listener),
      load: () => ad.load(),
      show: () => ad.show(),
      destroy: () => ad.destroy(),
    };
  },
});

/** Level Complete talks only to this gate; the game store never learns about ads. */
export const interstitialGate = new InterstitialGate({
  policy: new InterstitialPolicy(AsyncStorage, STORAGE_KEY_INTERSTITIAL),
  controller: interstitialAds,
  rewarded: new RewardedActivity(rewardedAds),
  supported: rewardedAdsSupported,
});
