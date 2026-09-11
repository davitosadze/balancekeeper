import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { getTotalLevels } from '@/data/levels';
import Ball from '@/components/Ball';
import SceneBackground from '@/components/SceneBackground';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import FadeSlideIn from '@/components/FadeSlideIn';
import { UI_COLORS, FONTS } from '@/utils/constants';

const CYCLE_MS = 1800;
const FALL_MS = 500;
const SETTLE_MS = 150;
const FADE_MS = 250;

/**
 * Landing screen: bright hero with a looping "ball drops into bottle, bottle
 * fills" graphic (showing the actual game mechanic) and title over the
 * outdoor scene, staggered entrance animations, primary actions, lifetime
 * statistics, and an overall level-progress bar that fills in on mount.
 */
export default function MainMenu() {
  const router = useRouter();
  const progress = useGameStore((state) => state.progress);
  const hasStats = progress.levelsCompleted > 0 || progress.bestScore > 0;
  const totalLevels = getTotalLevels();
  const progressPct = Math.round((progress.levelsCompleted / totalLevels) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <SceneBackground />

      <View style={styles.hero}>
        <FadeSlideIn distance={20}>
          <Text style={styles.title}>Balance{'\n'}Keeper</Text>
        </FadeSlideIn>
        <FadeSlideIn delay={100} distance={16}>
          <Text style={styles.subtitle}>Fill Every Bottle Exactly</Text>
        </FadeSlideIn>
        <FadeSlideIn delay={220} distance={16}>
          <DropGraphic />
        </FadeSlideIn>
      </View>

      <View style={styles.actions}>
        <FadeSlideIn delay={380}>
          <Button label="Play Now" variant="primary" onPress={() => router.push('/level-select')} />
        </FadeSlideIn>
        <FadeSlideIn delay={450}>
          <Button label="How to Play" variant="secondary" onPress={() => router.push('/tutorial')} />
        </FadeSlideIn>
        <FadeSlideIn delay={520}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Text style={styles.iconButtonText}>⚙ Settings</Text>
          </Pressable>
        </FadeSlideIn>
      </View>

      {hasStats && (
        <FadeSlideIn delay={600}>
          <Card style={styles.stats}>
            <StatRow label="Best Score" value={progress.bestScore.toLocaleString()} />
            <StatRow label="Levels Completed" value={String(progress.levelsCompleted)} />
            <StatRow
              label="Total Playtime"
              value={`${Math.round(progress.totalPlaytimeSeconds / 60)} min`}
            />
          </Card>
        </FadeSlideIn>
      )}

      <View style={styles.progressFooter}>
        <Text style={styles.progressLabel}>
          {progress.levelsCompleted}/{totalLevels} Levels Complete
        </Text>
        <Text style={styles.progressLabel}>Progress: {progressPct}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <AnimatedProgressFill percent={progressPct} />
      </View>
    </SafeAreaView>
  );
}

/** Loops "ball falls, lands, bottle fills, resets" to showcase the actual game mechanic at a glance. */
function DropGraphic() {
  const dropY = useSharedValue(-30);
  const ballOpacity = useSharedValue(1);
  const fillHeight = useSharedValue(0);

  useEffect(() => {
    dropY.value = withRepeat(
      withSequence(
        withTiming(-30, { duration: 0 }),
        withTiming(0, { duration: FALL_MS, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: CYCLE_MS - FALL_MS })
      ),
      -1,
      false
    );
    ballOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: FALL_MS + SETTLE_MS }),
        withTiming(0, { duration: FADE_MS }),
        withTiming(0, { duration: CYCLE_MS - FALL_MS - SETTLE_MS - FADE_MS })
      ),
      -1,
      false
    );
    fillHeight.value = withRepeat(
      withSequence(
        withTiming(0, { duration: FALL_MS }),
        withTiming(28, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(28, { duration: 400 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: CYCLE_MS - FALL_MS - 300 - 400 })
      ),
      -1,
      false
    );
  }, [dropY, ballOpacity, fillHeight]);

  const ballStyle = useAnimatedStyle(() => ({
    opacity: ballOpacity.value,
    transform: [{ translateY: dropY.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    height: fillHeight.value,
  }));

  return (
    <View style={styles.pourGraphic}>
      <View style={styles.pourTube}>
        <Animated.View style={[styles.fillBar, fillStyle]} />
        <Animated.View style={[styles.dropBallWrap, ballStyle]}>
          <Ball color="cyan" weight={2} />
        </Animated.View>
      </View>
    </View>
  );
}

function AnimatedProgressFill({ percent }: { percent: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(700, withTiming(percent, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [percent, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return <Animated.View style={[styles.progressFill, style]} />;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    fontFamily: FONTS.displayBold,
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(15, 23, 42, 0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    marginTop: 8,
    opacity: 0.75,
    textAlign: 'center',
  },
  pourGraphic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  pourTube: {
    width: 40,
    height: 64,
    borderRadius: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 182, 212, 0.45)',
  },
  dropBallWrap: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  iconButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  stats: {
    marginTop: 40,
    width: '100%',
    maxWidth: 320,
    padding: 16,
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  statValue: {
    color: '#6ee7b7',
    fontSize: 13,
    fontFamily: FONTS.displayBold,
  },
  progressFooter: {
    position: 'absolute',
    bottom: 34,
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 24,
    width: '100%',
    maxWidth: 320,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#059669',
  },
});
