import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { LEVELS, getUnlockedLevels } from '@/data/levels';
import SceneBackground from '@/components/SceneBackground';
import Card from '@/components/ui/Card';
import FadeSlideIn from '@/components/FadeSlideIn';
import { UI_COLORS, FONTS, HEADER_PILL_GRADIENT, DIFFICULTY_COLORS } from '@/utils/constants';
import type { Level, LevelProgress } from '@/types/game';

const STAGGER_STEP_MS = 25;
const MAX_STAGGER_MS = 420;

/**
 * Grid of all levels over the bright outdoor scene, matching the gameplay
 * screen's flat, colorful look. Each card is tinted by difficulty, fades and
 * slides in staggered on mount, the next playable level pulses gently to
 * draw the eye, and every card gives a press-scale bounce. Tapping an
 * unlocked level starts it immediately.
 */
export default function LevelSelect() {
  const router = useRouter();
  const progress = useGameStore((state) => state.progress);
  const loadLevel = useGameStore((state) => state.loadLevel);
  const unlocked = getUnlockedLevels(progress.unlockedLevels);

  const nextPlayableId = LEVELS.find((l) => unlocked.includes(l.id) && !progress.levelProgress[l.id]?.completed)?.id;

  const handleSelect = (levelId: number) => {
    if (!unlocked.includes(levelId)) return;
    loadLevel(levelId);
    router.push('/game');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <SceneBackground />

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.push('/')}
          accessibilityRole="button"
          accessibilityLabel="Back to main menu"
          style={styles.backButton}
        >
          <LinearGradient colors={HEADER_PILL_GRADIENT} style={StyleSheet.absoluteFillObject} />
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <View style={styles.titlePill}>
          <LinearGradient colors={HEADER_PILL_GRADIENT} style={StyleSheet.absoluteFillObject} />
          <Text style={styles.header}>Select Level</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {LEVELS.map((level, index) => {
          const isUnlocked = unlocked.includes(level.id);
          const levelProgress = progress.levelProgress[level.id];
          const isNextPlayable = level.id === nextPlayableId;

          return (
            <FadeSlideIn key={level.id} delay={Math.min(index * STAGGER_STEP_MS, MAX_STAGGER_MS)} distance={14} style={styles.cardWrap}>
              <LevelCard
                level={level}
                isUnlocked={isUnlocked}
                isNextPlayable={isNextPlayable}
                levelProgress={levelProgress}
                onSelect={() => handleSelect(level.id)}
              />
            </FadeSlideIn>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function LevelCard({
  level,
  isUnlocked,
  isNextPlayable,
  levelProgress,
  onSelect,
}: {
  level: Level;
  isUnlocked: boolean;
  isNextPlayable: boolean;
  levelProgress: LevelProgress | undefined;
  onSelect: () => void;
}) {
  const pulse = useSharedValue(0);
  const accent = isUnlocked ? DIFFICULTY_COLORS[level.difficulty] : '#94a3b8';

  useEffect(() => {
    if (!isNextPlayable) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [isNextPlayable, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    shadowOpacity: isNextPlayable ? 0.35 + pulse.value * 0.45 : 0,
    transform: [{ scale: isNextPlayable ? 1 + pulse.value * 0.02 : 1 }],
  }));

  return (
    <Animated.View style={[isNextPlayable && styles.cardGlow, pulseStyle]}>
      <Pressable
        disabled={!isUnlocked}
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityLabel={isUnlocked ? `Level ${level.id}, ${level.name}` : `Level ${level.id}, locked`}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <Card variant="light" style={[styles.card, { borderColor: accent }, !isUnlocked && styles.cardLocked]}>
          <View style={[styles.difficultyDot, { backgroundColor: accent }]} />
          <Text style={styles.cardNumber}>{isUnlocked ? level.id : '🔒'}</Text>
          <Text style={[styles.cardStars, { color: accent }]}>
            {'★'.repeat(level.difficulty)}
            {'☆'.repeat(5 - level.difficulty)}
          </Text>
          {levelProgress?.completed && (
            <>
              <Text style={styles.cardScore}>{levelProgress.bestScore.toLocaleString()}</Text>
              <Text style={styles.cardEarned}>
                {'⭐'.repeat(levelProgress.stars)}
                {'☆'.repeat(3 - levelProgress.stars)}
              </Text>
            </>
          )}
        </Card>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    color: '#f1f5f9',
    fontSize: 18,
    fontFamily: FONTS.displayBold,
  },
  titlePill: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    fontSize: 18,
    fontFamily: FONTS.displayBold,
    color: '#f1f5f9',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 24,
    gap: 12,
  },
  cardWrap: {
    width: '47%',
  },
  cardGlow: {
    shadowColor: UI_COLORS.selected,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    padding: 16,
    alignItems: 'center',
  },
  cardPressed: {
    transform: [{ scale: 0.95 }],
  },
  cardLocked: {
    backgroundColor: '#dbe2ea',
  },
  difficultyDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardNumber: {
    fontSize: 22,
    fontFamily: FONTS.displayBold,
    color: UI_COLORS.background,
  },
  cardStars: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: FONTS.displaySemiBold,
  },
  cardScore: {
    fontSize: 12,
    fontFamily: FONTS.displaySemiBold,
    color: '#047857',
    marginTop: 8,
  },
  cardEarned: {
    fontSize: 13,
    marginTop: 2,
  },
});
