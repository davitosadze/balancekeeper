import { prepareGameplayAssets } from '@/assets/preload';
import { useEquippedCosmetic } from '@/hooks/useCosmetics';
import { useShallow } from 'zustand/react/shallow';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter, useFocusEffect } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { getLevelById, getTotalLevels } from '@/data/levels';
import { rewardTransactionId } from '@/domain/economy';
import SceneBackground from '@/components/SceneBackground';
import Confetti from '@/components/Confetti';
import { WoodlandBackdrop, WoodPanel, WoodButton as Button, Ribbon, Encouragement } from '@/components/ui/Woodland';
import GameIcon from '@/components/ui/GameIcon';
import FixedResultLayout from '@/components/ui/FixedResultLayout';
import FadeSlideIn from '@/components/FadeSlideIn';
import PopIn from '@/components/PopIn';
import CountUpText from '@/components/CountUpText';
import { useAudio } from '@/hooks/useAudio';
import { useHaptics } from '@/hooks/useHaptics';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { EFFECT_TIMING } from '@/domain/bottleFeedback';
import { GAME_FONT } from '@/components/gameplay/assets';
import { interstitialGate } from '@/services/ads/interstitialAds';

export default function LevelComplete() {
  const router = useRouter();
  const compact = useWindowDimensions().height < 700;
  const reduced = useReducedMotionPreference();
  const {playSound} = useAudio();
  const {triggerHaptic} = useHaptics();
  const feedback = useRef({playSound, triggerHaptic});
  feedback.current = {playSound, triggerHaptic};
  const state = useGameStore(useShallow(({progress,hydrated,cosmeticBusy,status,rewardCommitStatus,attemptId,commitLevelReward,pendingLevelReward,earnedStars,level,finishResult,isReplay,moves,mistakes,undoUsed,hintUsed,storageError})=>({progress,hydrated,cosmeticBusy,status,rewardCommitStatus,attemptId,commitLevelReward,pendingLevelReward,earnedStars,level,finishResult,isReplay,moves,mistakes,undoUsed,hintUsed,storageError})));
  const [animationReady, setAnimationReady] = useState(false);
  const navigating = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pending = state.pendingLevelReward;
  const backgroundId = useEquippedCosmetic('background'), bottleSkinId = useEquippedCosmetic('bottle');
  useEffect(() => {
    // Configs are already normalized in the static registry; no generation or solver here.
    getLevelById(Math.min(state.level + 1, getTotalLevels()));
    // Pure lookahead: defer until the confetti/star/reward entrance animations settle,
    // so decoding the next level's images doesn't compete with them for the JS thread.
    const task = InteractionManager.runAfterInteractions(() => {
      void prepareGameplayAssets(backgroundId,bottleSkinId).catch(() => {});
    });
    return () => task.cancel();
  },[state.level,backgroundId,bottleSkinId]);
  useEffect(() => {
    if (state.hydrated && !state.cosmeticBusy && state.status === 'won' && state.rewardCommitStatus === 'idle') {
      void state.commitLevelReward(state.attemptId);
    }
  }, [state.hydrated, state.cosmeticBusy, state.status, state.attemptId, state.rewardCommitStatus, state.commitLevelReward]);
  // Counted only after the reward is saved, so a failed save or a lost attempt never advances the ad counter.
  useEffect(() => {
    if (state.hydrated) {
      void interstitialGate.recordLevelResult({ status: state.status, rewardSaved: state.rewardCommitStatus === 'saved',
        attemptId: state.attemptId, isReplay: state.isReplay });
    }
  }, [state.hydrated, state.status, state.rewardCommitStatus, state.attemptId, state.isReplay]);
  useEffect(() => {
    setAnimationReady(false);
    const timer = setTimeout(() => setAnimationReady(true), reduced ? 120 : EFFECT_TIMING.result);
    return () => clearTimeout(timer);
  }, [state.attemptId, reduced]);
  // The completion fanfare plays here, once this screen is actually on screen, rather than
  // back on the Gameplay screen. The star pops, coin tally and unlock reveal stay silent so
  // the finish reads as one clean sound rather than a stack of chimes.
  useFocusEffect(useCallback(() => {
    if(!state.hydrated || state.status !== 'won') return;
    feedback.current.playSound('levelComplete');
  }, [state.attemptId, state.hydrated, state.status]));
  if (!state.hydrated) return <View style={{ flex: 1 }}><SceneBackground gameplay /></View>;
  if (state.status !== 'won' || !pending) return <Redirect href="/game" />;
  const rewards = pending.rewards;
  const milestone = getLevelById(state.level).milestone;
  const receipt = state.progress.transactions[rewardTransactionId(state.attemptId)];
  const balanceBefore = receipt?.balanceBefore ?? state.progress.coins;
  const balanceAfter = receipt?.balanceAfter ?? balanceBefore + rewards.total;
  const ready = animationReady && state.rewardCommitStatus === 'saved';
  const play = (destination: 'continue' | 'replay' | 'levels') => {
    if (!ready || navigating.current) return;
    const lastLevel = state.level === getTotalLevels();
    const leave = () => {
      if (!mounted.current) return;
      if (!state.finishResult(state.attemptId, destination)) { navigating.current = false; return; }
      router.replace(destination === 'levels' || (destination === 'continue' && lastLevel) ? '/level-select' : '/game');
    };
    feedback.current.playSound('buttonTap'); feedback.current.triggerHaptic('select');
    navigating.current = true;
    // The result has been seen; Continue is the natural break. Every other exit skips ads.
    // The gate settles whether or not an ad ran, so progression never depends on it.
    if (destination === 'continue') void interstitialGate.continueWith(leave);
    else leave();
  };
  return <View style={{ flex: 1 }}>
    <WoodlandBackdrop />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Confetti /></View>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
      <FixedResultLayout>
        <View style={styles.scene}>
          <FadeSlideIn duration={180}><Ribbon title="LEVEL COMPLETE!" /></FadeSlideIn>
          <Text style={styles.eyebrow}>{milestone?.title ?? `LEVEL ${state.level} BALANCED`}</Text>
          <View accessibilityLabel={`${state.earnedStars} of 3 stars earned`} style={styles.stars}>
            {[1, 2, 3].map(n => <PopIn key={n} delay={100 + n * 90}><Text style={[styles.star, { fontSize: compact ? 65 : n === 2 ? 92 : 80 }, n <= state.earnedStars && styles.earned]}>★</Text></PopIn>)}
          </View>
          <WoodPanel style={styles.rewards}>
            <RewardRow label="Level Reward" icon="●" value={rewards.baseCoins} delay={240} />
            <RewardRow label="Perfect Fits" icon="◉" value={rewards.perfectFitCoins} delay={280} />
            <RewardRow label="Combo Bonus" icon="♨" value={rewards.comboBonus} delay={320} />
            <RewardRow label="3-Star Bonus" icon="★" value={rewards.threeStarBonus} delay={360} />
            <FadeSlideIn delay={430} duration={160} style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL COINS</Text>
              <View style={styles.total}><GameIcon name="coin" size={36} /><CountUpText value={rewards.total} delay={430} duration={300} style={styles.totalValue} /></View>
            </FadeSlideIn>
            <View accessibilityLabel={`Coins: ${balanceBefore} to ${balanceAfter}`} style={styles.balance}>
              <Text style={styles.copy}>Balance  {balanceBefore.toLocaleString()} → </Text>
              <CountUpText from={balanceBefore} value={balanceAfter} delay={570} duration={240} style={styles.balanceValue} />
            </View>
          </WoodPanel>
          {state.isReplay && <Text style={styles.copy}>Replay: skill bonuses only.</Text>}
          <Text style={styles.stats}>{state.moves} moves · {state.mistakes} mistakes · {state.undoUsed} undo · {state.hintUsed} hints</Text>
          {state.rewardCommitStatus === 'error' && <>
            <Text accessibilityLiveRegion="polite" style={styles.copy}>{state.storageError}</Text>
            <Button label="RETRY SAVE" onPress={() => { void state.commitLevelReward(state.attemptId); }} />
          </>}
          <View style={styles.actions}>
            <Button label="Replay" accessibilityLabel="REPLAY" disabled={!ready} variant="secondary" onPress={() => play('replay')} style={{ flex: 1 }} />
            <Button label="Continue" accessibilityLabel="CONTINUE" disabled={!ready} onPress={() => play('continue')} style={{ flex: 1.12 }} />
          </View>
          <Encouragement success />
          {milestone && <Text style={styles.copy}>{milestone.completionMessage}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="LEVELS" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => play('levels')} style={styles.levels}><Text style={styles.copy}>Back to levels</Text></Pressable>
        </View>
      </FixedResultLayout>
    </SafeAreaView>
  </View>;
}

function RewardRow({ label, icon, value, delay }: { label: string; icon: string; value: number; delay: number }) {
  return <FadeSlideIn delay={delay} duration={180} style={styles.row}><Text style={styles.rewardIcon}>{icon}</Text><Text style={styles.rewardLabel}>{label}</Text><Text style={styles.value}>{value}</Text></FadeSlideIn>;
}
const styles = StyleSheet.create({
  scene: { width: '100%', maxWidth: 350, gap: 7 },
  eyebrow: { color: '#f2d39c', fontFamily: GAME_FONT, fontSize: 11, letterSpacing: 2, textAlign: 'center', marginTop: 3 },
  stars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: -14, marginBottom: -8 },
  star: { color: '#705438', textShadowColor: '#32180b', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 2 },
  earned: { color: '#ffd345', textShadowColor: '#ffb21c', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 17 },
  rewards: { paddingHorizontal: 18, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 43, borderBottomWidth: 1, borderColor: 'rgba(220,161,87,.2)' },
  rewardIcon: { width: 25, color: '#ffcc50', fontSize: 25, textAlign: 'center' },
  rewardLabel: { flex: 1, color: '#f4dfbd', fontFamily: GAME_FONT, fontSize: 16 },
  value: { color: '#ffe397', fontFamily: GAME_FONT, fontWeight: '600', fontSize: 21 },
  totalRow: { alignItems: 'center', paddingTop: 12, gap: 2 },
  total: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  totalLabel: { color: '#ffdf8e', fontFamily: GAME_FONT, fontWeight: '700', fontSize: 18 },
  totalValue: { color: '#ffe07d', fontFamily: GAME_FONT, fontWeight: '800', fontSize: 43, textShadowColor: '#2f1908', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 2 },
  balance: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  balanceValue: { color: '#ffdf8b', fontFamily: GAME_FONT, fontSize: 12 },
  copy: { color: '#e3ceb0', fontFamily: GAME_FONT, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  stats: { color: '#ddcba7', fontFamily: GAME_FONT, fontSize: 11, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  levels: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
