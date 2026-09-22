import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { WoodlandBackdrop, Ribbon, WoodButton, Encouragement } from '../ui/Woodland';
import FixedResultLayout from '../ui/FixedResultLayout';
import { getBottleSkinAsset } from '@/assets/cosmetics';
import { useEquippedCosmetic } from '@/hooks/useCosmetics';
import { GAME_FONT } from './assets';
import type { AdStatus } from '@/services/ads/rewardedController';

export default function FailureScreen({ reviveAvailable, reviveCost, coins, busy, onRevive, onRestart, onLevels, rewardedAd }: {
  reviveAvailable: boolean; reviveCost: number; coins: number; busy: boolean;
  onRevive: () => void; onRestart: () => void; onLevels: () => void;
  rewardedAd?: { status: AdStatus; notice: string | null; onPress: () => void };
}) {
  const compact = useWindowDimensions().height < 700;
  const bottleSkinId = useEquippedCosmetic('bottle');
  // Reuse the equipped skin's own shattered-glass art (already loaded via getActiveGameplayAssets)
  // rather than a separate standalone asset, matching how Tube.tsx renders the broken stage.
  const brokenBottle = getBottleSkinAsset(bottleSkinId, 'broken').source;
  return <View testID="failure-screen" style={styles.root} accessibilityViewIsModal>
    <WoodlandBackdrop room dark />
    <FixedResultLayout>
      <View style={styles.scene}>
        <Ribbon title="BOTTLE BROKEN!" />
        <Text style={styles.copy}>{reviveAvailable ? "Don’t give up!\nTry again or continue\nfrom where you left off." : "Don’t give up!\nA fresh start is another\nchance to find your balance."}</Text>
        <View pointerEvents="none" style={[styles.art, { height: compact ? 195 : 260 }]}>
          <View style={styles.ground} />
          <Image source={brokenBottle} resizeMode="contain" style={[styles.bottle, { height: compact ? 195 : 255 }]} />
          <Image source={require('../../../assets/weights/weight-red.webp')} resizeMode="contain" style={styles.redBall} />
          <Image source={require('../../../assets/weights/weight-heavy.webp')} resizeMode="contain" style={styles.heavyBall} />
        </View>
        {reviveAvailable && <>
          <WoodButton label={`Continue  ◉ ${reviveCost}`} accessibilityLabel={`CONTINUE · ${reviveCost} COINS`} variant="accent" disabled={coins < reviveCost || busy} onPress={onRevive} />
          {coins < reviveCost && <Text accessibilityLiveRegion="polite" style={styles.notice}>Need {reviveCost - coins} more coins</Text>}
          {rewardedAd && <>
            <WoodButton
              label={rewardedAd.status === 'loading' || rewardedAd.status === 'idle' ? 'Loading Ad...' : rewardedAd.status === 'showing' ? 'Ad in progress...' : rewardedAd.status === 'ready' ? 'Watch Ad — Continue' : 'Ad Unavailable'}
              variant="secondary" disabled={busy || rewardedAd.status !== 'ready'} onPress={rewardedAd.onPress} />
            {rewardedAd.notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{rewardedAd.notice}</Text>}
          </>}
        </>}
        <WoodButton label="Restart" accessibilityLabel="RESTART" variant="secondary" onPress={onRestart} disabled={busy} />
        <Encouragement />
        <Pressable accessibilityRole="button" accessibilityLabel="LEVELS" accessibilityState={{disabled:busy}} onPress={onLevels} disabled={busy} style={styles.levels}><Text style={styles.notice}>Back to levels</Text></Pressable>
      </View>
    </FixedResultLayout>
  </View>;
}
const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#20150f', alignItems: 'center' },
  scene: { width: '100%', maxWidth: 350, gap: 10 },
  copy: { fontFamily: GAME_FONT, color: '#f1e0c5', textAlign: 'center', fontSize: 18, lineHeight: 27, textShadowColor: '#160d06', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  art: { alignItems: 'center', justifyContent: 'flex-end', marginVertical: 0 },
  bottle: { width: 210, transform: [{ rotate: '13deg' }], marginLeft: -22, marginBottom: 7 },
  ground: { position: 'absolute', bottom: 0, width: '100%', height: 27, borderRadius: 100, backgroundColor: 'rgba(12,8,5,.6)', shadowColor: '#e49338', shadowOpacity: .4, shadowRadius: 20, shadowOffset: { width: 0, height: -10 } },
  redBall: { position: 'absolute', bottom: 5, left: '16%', width: 91, height: 91 },
  heavyBall: { position: 'absolute', bottom: 0, right: '6%', width: 92, height: 92 },
  levels: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  notice: { fontFamily: GAME_FONT, color: '#f3cf9e', textAlign: 'center', fontSize: 13 },
});
