export const ANDROID_REWARDED_TEST_ID = 'ca-app-pub-3940256099942544/5224354917';
export const ANDROID_REWARDED_PRODUCTION_ID = 'ca-app-pub-1563611163993912/3795783460';
export const ANDROID_INTERSTITIAL_TEST_ID = 'ca-app-pub-3940256099942544/1033173712';
export const ANDROID_INTERSTITIAL_PRODUCTION_ID = 'ca-app-pub-1563611163993912/6139884934';

function selectUnitId(development: boolean, testId: string, productionId: string): string {
  // Check development first: no override can select a live unit in a debug build.
  if (development) return testId;
  if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(productionId)) throw new Error('Invalid ad unit ID');
  return productionId;
}
export function selectRewardedUnitId(development: boolean, productionId = ANDROID_REWARDED_PRODUCTION_ID): string {
  return selectUnitId(development, ANDROID_REWARDED_TEST_ID, productionId);
}
export function selectInterstitialUnitId(development: boolean, productionId = ANDROID_INTERSTITIAL_PRODUCTION_ID): string {
  return selectUnitId(development, ANDROID_INTERSTITIAL_TEST_ID, productionId);
}

const development = typeof __DEV__ !== 'undefined' && __DEV__;
export const REWARDED_UNIT_ID = selectRewardedUnitId(development);
export const INTERSTITIAL_UNIT_ID = selectInterstitialUnitId(development);
export const AD_LOAD_TIMEOUT_MS = 20_000;
export const AD_RETRY_DELAY_MS = 30_000;
export const AD_MAX_AGE_MS = 55 * 60_000;

/** One interstitial opportunity per this many NEW level completions. */
export const INTERSTITIAL_COMPLETION_INTERVAL = 5;
/** No interstitial this soon after a rewarded ad was watched. */
export const INTERSTITIAL_AFTER_REWARDED_COOLDOWN_MS = 2 * 60_000;
/** No interstitial this soon after the previous interstitial. */
export const INTERSTITIAL_MIN_INTERVAL_MS = 60_000;
/** An accepted show() must open promptly; otherwise the player continues without it. */
export const INTERSTITIAL_OPEN_TIMEOUT_MS = 5_000;
