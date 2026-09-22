import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ConsentManager } from './consentManager';
import { REWARDED_UNIT_ID } from './config';
import { RewardedController, type AdEvent } from './rewardedController';

export const rewardedAdsSupported = Platform.OS === 'android' && Constants.executionEnvironment !== 'storeClient';
type MobileAdsModule = typeof import('react-native-google-mobile-ads');
let nativeSDK: MobileAdsModule | undefined;
export function mobileAdsSDK(): MobileAdsModule {
  if (!rewardedAdsSupported) throw new Error('Rewarded ads require an Android development or release build');
  // Expo Go and web must never evaluate the native module.
  nativeSDK ??= require('react-native-google-mobile-ads') as MobileAdsModule;
  return nativeSDK;
}
export const adsConsent = new ConsentManager({
  requestInfoUpdate: () => mobileAdsSDK().AdsConsent.requestInfoUpdate(),
  loadAndShowConsentFormIfRequired: () => mobileAdsSDK().AdsConsent.loadAndShowConsentFormIfRequired(),
  getConsentInfo: () => mobileAdsSDK().AdsConsent.getConsentInfo(),
  showPrivacyOptionsForm: () => mobileAdsSDK().AdsConsent.showPrivacyOptionsForm(),
  initializeAds: () => mobileAdsSDK().default().initialize(),
});

export const rewardedAds = new RewardedController({
  initialize: async () => rewardedAdsSupported && adsConsent.initialize(),
  create: () => {
    const { RewardedAd, RewardedAdEventType, AdEventType } = mobileAdsSDK();
    const ad = RewardedAd.createForAdRequest(REWARDED_UNIT_ID);
    const events = {
      loaded: RewardedAdEventType.LOADED,
      earned: RewardedAdEventType.EARNED_REWARD,
      opened: AdEventType.OPENED,
      closed: AdEventType.CLOSED,
      error: AdEventType.ERROR,
    };
    return {
      listen: (event: AdEvent, listener: () => void) => ad.addAdEventListener(events[event], listener),
      load: () => ad.load(),
      show: () => ad.show(),
      destroy: () => ad.destroy(),
    };
  },
});
