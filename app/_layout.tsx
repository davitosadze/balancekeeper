import React, { useCallback, useEffect } from 'react';
import { View, AppState, AccessibilityInfo, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore, loadSettings } from '@/store/settingsStore';
import { soundManager } from '@/services/soundManager';
import { musicManager } from '@/services/musicManager';
import { startAds } from '@/services/ads/adsLifecycle';
import { UI_COLORS } from '@/utils/constants';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root navigation stack. Loads the Space Grotesk display font before the
 * first paint (keeping the native splash screen up in the meantime), then
 * shares the dark theme background across every screen.
 */
export default function RootLayout() {
  useEffect(() => {
    void loadSettings();
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if(active)useSettingsStore.setState({systemReducedMotion:value});}).catch(()=>{});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => useSettingsStore.setState({systemReducedMotion:value}));
    const flush = () => {void useGameStore.getState().flushPersistence().catch(()=>{});};
    const app = AppState.addEventListener('change',status => {if(status !== 'active')flush();});
    const visibility = () => {if(document.visibilityState === 'hidden')flush();};
    if(Platform.OS === 'web'){window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);}
    return () => {active=false;motion.remove();app.remove();flush();soundManager.dispose();musicManager.dispose();if(Platform.OS==='web'){window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);}};
  }, []);
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const fontReady = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontReady) return startAds();
  }, [fontReady]);
  useEffect(() => {
    if (fontReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontReady]);

  const onLayoutRootView = useCallback(() => {
    if (fontReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontReady]);

  if (!fontReady) {
    return <View style={{ flex: 1, backgroundColor: UI_COLORS.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: UI_COLORS.background },
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}
