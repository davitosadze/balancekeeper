import { AppState } from 'react-native';
import { interstitialAds } from './interstitialAds';
import { adsConsent, rewardedAds, rewardedAdsSupported } from './rewardedAds';

/** Root effect owns only the lifecycle listener; SDK/consent initialization is shared and idempotent. */
export function startAds() {
  if (!rewardedAdsSupported) return () => {};
  void rewardedAds.resume();
  void interstitialAds.resume();
  const subscription = AppState.addEventListener('change', status => {
    if (status === 'active') {
      void rewardedAds.preload();
      void interstitialAds.preload();
    }
  });
  return () => {
    subscription.remove();
    rewardedAds.suspend();
    interstitialAds.suspend();
  };
}

export async function showAdsPrivacyOptions() {
  if (!rewardedAds.suspend()) return false;
  if (!interstitialAds.suspend()) {
    void rewardedAds.resume();
    return false;
  }
  try { return await adsConsent.showPrivacyOptions(); }
  finally {
    void rewardedAds.resume();
    void interstitialAds.resume();
  }
}
