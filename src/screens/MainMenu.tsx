import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { getTotalLevels } from '@/data/levels';
import { MainBackground, GameLogo, Tagline, HeroBottle } from '@/components/main/MainArtwork';
import { MainTopHud, MainPlayButton, BottomMenu, FooterMessage, TactileButton } from '@/components/main/MainChrome';
import { GlassPanel } from '@/components/gameplay/GameplayHud';
import { GAME_FONT } from '@/components/gameplay/assets';
import { useAudio } from '@/hooks/useAudio';
import { useHaptics } from '@/hooks/useHaptics';
import { useMusic } from '@/hooks/useMusic';

/** Asset-based home composition. Navigation and progress use the existing app. */
export default function MainMenu() {
  const router = useRouter();
  const progress = useGameStore(state => state.progress);
  const level = useGameStore(state => state.level);
  const window = useWindowDimensions();
  const [layout, setLayout] = useState({ width: Math.min(window.width, 600), height: window.height });
  const [showCoins, setShowCoins] = useState(false);
  const width = layout.width;
  const height = layout.height;
  const scale = width / 430;
  const { playSound } = useAudio();
  const { triggerHaptic } = useHaptics();
  useMusic('menu');
  const tap = () => { playSound('buttonTap'); triggerHaptic('select'); };
  const onPlay = () => {
    tap();
    const state = useGameStore.getState();
    if (state.status === 'won') { router.push('/level-complete'); return; }
    if (state.status === 'lost') { router.push('/game'); return; }
    router.push('/game');
  };
  const onSettings = () => { tap(); router.push('/settings'); };
  const onShop = () => { tap(); router.push('/shop'); };
  const onLevels = () => { tap(); router.push('/level-select'); };
  const onGuide = () => { tap(); router.push('/tutorial'); };
  const onCoins = () => { tap(); setShowCoins(true); };
  const onCloseCoins = () => { tap(); setShowCoins(false); };

  return <View style={styles.root}>
    <MainBackground />
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View testID="main-screen" onLayout={e => setLayout(e.nativeEvent.layout)} style={styles.scene}>
        <View style={{ position: 'absolute', top: height * .018, left: width * .033, right: width * .027 }}>
          <MainTopHud level={level} coins={progress.coins} progress={progress.levelsCompleted / getTotalLevels()} scale={scale} onCoins={onCoins} />
        </View>
        <View style={{ position: 'absolute', top: height * .096, alignSelf: 'center' }}><GameLogo width={Math.min(width * .64, height * .36)} /></View>
        <View style={{ position: 'absolute', top: height * .247, left: width * .105 }}><Tagline width={Math.min(width * .29, height * .16)} /></View>
        <View style={{ position: 'absolute', bottom: height * .346, alignSelf: 'center' }}><HeroBottle width={width * .275} height={height * .39} /></View>
        <View style={{ position: 'absolute', top: height * .668, alignSelf: 'center' }}><MainPlayButton width={width * .58} height={height * .082} onPress={onPlay} /></View>
        <View style={{ position: 'absolute', top: height * .771, alignSelf: 'center' }}><BottomMenu onShop={onShop} scale={scale} onLevels={onLevels} onGuide={onGuide} onSettings={onSettings} /></View>
        <View style={{ position: 'absolute', top: height * .883, alignSelf: 'center' }}><FooterMessage scale={scale} /></View>
      </View>
    </SafeAreaView>
    <Modal transparent visible={showCoins} animationType="fade" onRequestClose={onCloseCoins}>
      <View style={styles.modalBackdrop}>
        <GlassPanel style={styles.coinPanel}>
          <Text style={styles.modalTitle}>{progress.coins.toLocaleString()} coins</Text>
          <Text style={styles.modalCopy}>Complete levels to earn coins. Replays earn skill bonuses.</Text>
          {__DEV__ && <TactileButton label="DEV: Add 500 coins"
            onPress={() => { tap(); useGameStore.getState().debugAddCoins?.(); }} style={{ width: 190, height: 42 }}>
            <GlassPanel style={styles.closeButton}><Text style={styles.closeText}>DEV: Add 500 coins</Text></GlassPanel>
          </TactileButton>}
          <TactileButton label="Close coin information" onPress={onCloseCoins} style={{ width: 160, height: 42 }}>
            <GlassPanel style={styles.closeButton}><Text style={styles.closeText}>Got it</Text></GlassPanel>
          </TactileButton>
        </GlassPanel>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7e5131' },
  safeArea: { flex: 1 },
  scene: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(30,20,12,.6)', alignItems: 'center', justifyContent: 'center' },
  coinPanel: { width: '82%', maxWidth: 330, padding: 25, alignItems: 'center', gap: 17, borderRadius: 23 },
  modalTitle: { color: '#fff0d8', fontFamily: GAME_FONT, fontSize: 24, fontWeight: '700' },
  modalCopy: { color: '#e7ccaa', fontFamily: GAME_FONT, fontSize: 14, textAlign: 'center' },
  closeButton: { flex: 1, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#fff0d8', fontFamily: GAME_FONT, fontSize: 15, fontWeight: '600' },
});
