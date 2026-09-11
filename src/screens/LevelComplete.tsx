import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { LEVELS, getLevelById, getTotalLevels, getUnlockedLevels } from '@/data/levels';
import { calculateStars } from '@/utils/scoring';
import AmbientBackground from '@/components/AmbientBackground';
import Confetti from '@/components/Confetti';
import Button from '@/components/ui/Button';
import FadeSlideIn from '@/components/FadeSlideIn';
import PopIn from '@/components/PopIn';
import CountUpText from '@/components/CountUpText';
import { UI_COLORS, FONTS } from '@/utils/constants';

/**
 * Post-level summary: a colored win/loss banner, a stats breakdown, star
 * rating, a "why did I lose" tip on failure, a compact strip of nearby
 * levels, and navigation to the next level, a retry, or the main menu.
 */
export default function LevelComplete() {
  const router = useRouter();
  const gameState = useGameStore();
  const loadLevel = useGameStore((state) => state.loadLevel);
  const progress = gameState.progress;
  const level = getLevelById(gameState.level);
  const targetTubeCount = gameState.tubes.length;
  const won = gameState.completedTubes.length >= targetTubeCount;
  const stars = won ? calculateStars(gameState.moves, level.minMoves) : 0;
  const hasNextLevel = level.id < getTotalLevels() && won;
  const unlocked = getUnlockedLevels(progress.unlockedLevels);

  const nearbyLevels = LEVELS.filter((l) => Math.abs(l.id - level.id) <= 2).slice(0, 5);

  const handleRetry = () => {
    loadLevel(level.id);
    router.push('/game');
  };

  const handleNext = () => {
    loadLevel(level.id + 1);
    router.push('/game');
  };

  const handlePickLevel = (id: number) => {
    if (!unlocked.includes(id)) return;
    loadLevel(id);
    router.push('/game');
  };

  const bannerColor = won ? '#10b981' : '#ef4444';

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBackground />
      {won && <Confetti />}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <FadeSlideIn distance={28} duration={460} style={[styles.card, { borderColor: bannerColor }]}>
          <View style={[styles.banner, { backgroundColor: bannerColor }]}>
            <Text style={styles.bannerText}>{won ? 'LEVEL COMPLETE!' : 'LEVEL FAILED!'}</Text>
          </View>
          <Text style={styles.subtitle}>{won ? 'Level Attempt Summary' : 'Out of moves!'}</Text>

          {won && (
            <>
              <View style={styles.starsRow}>
                {[0, 1, 2].map((i) => (
                  <PopIn key={i} delay={250 + i * 160}>
                    <Text style={styles.starChar}>{i < stars ? '⭐' : '☆'}</Text>
                  </PopIn>
                ))}
              </View>
              {stars === 3 && (
                <PopIn delay={700}>
                  <Text style={styles.perfectLabel}>Perfect!</Text>
                </PopIn>
              )}
            </>
          )}

          <View style={styles.statsCard}>
            <FadeSlideIn delay={500} distance={10}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Final Score</Text>
                <CountUpText value={gameState.score} duration={1000} style={styles.statValue} />
              </View>
            </FadeSlideIn>
            <FadeSlideIn delay={580} distance={10}>
              <StatRow label="Bottles Filled" value={`${gameState.completedTubes.length}/${targetTubeCount}`} />
            </FadeSlideIn>
            <FadeSlideIn delay={660} distance={10}>
              <StatRow label="Moves Used" value={`${gameState.moves}/${gameState.maxMoves}`} />
            </FadeSlideIn>
            <FadeSlideIn delay={740} distance={10}>
              <StatRow label="Stars Earned" value={won ? `${stars}/3` : '0/3'} />
            </FadeSlideIn>
          </View>

          {!won && (
            <FadeSlideIn delay={500} style={styles.tipBox}>
              <Text style={styles.tipTitle}>Why did I lose?</Text>
              <Text style={styles.tipBody}>
                Ran out of moves, or the tray emptied before every bottle hit its exact target weight.
                Tip: check each bottle's remaining capacity before dropping a ball in — an overweight
                bottle can never be undone into a legal fill without Undo.
              </Text>
            </FadeSlideIn>
          )}
        </FadeSlideIn>

        <FadeSlideIn delay={820}>
          <Text style={styles.sectionLabel}>Level Select</Text>
          <View style={styles.levelRow}>
            {nearbyLevels.map((l) => {
              const isUnlocked = unlocked.includes(l.id);
              const lp = progress.levelProgress[l.id];
              const isCurrent = l.id === level.id;
              return (
                <Pressable
                  key={l.id}
                  disabled={!isUnlocked}
                  onPress={() => handlePickLevel(l.id)}
                  style={({ pressed }) => [
                    styles.levelChip,
                    isCurrent && styles.levelChipCurrent,
                    !isUnlocked && styles.levelChipLocked,
                    pressed && styles.pressedScale,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.levelChipNumber}>{isUnlocked ? l.id : '🔒'}</Text>
                  <Text style={styles.levelChipScore}>
                    {lp?.completed ? `Best: ${lp.bestScore.toLocaleString()}` : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={900} style={styles.actions}>
          {hasNextLevel && <Button label="Next Level" variant="primary" onPress={handleNext} />}
          {!won && <Button label="Play Again" variant="danger" onPress={handleRetry} />}
          {won && <Button label="Retry Level" variant="secondary" onPress={handleRetry} />}
          <Button label="Main Menu" variant="secondary" onPress={() => router.push('/')} />
        </FadeSlideIn>
      </ScrollView>
    </SafeAreaView>
  );
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
  },
  scrollContent: {
    padding: 20,
    paddingTop: 32,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  banner: {
    alignSelf: 'stretch',
    paddingVertical: 16,
    alignItems: 'center',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: FONTS.displayBold,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  starChar: {
    fontSize: 30,
  },
  pressedScale: {
    transform: [{ scale: 0.95 }],
  },
  perfectLabel: {
    color: '#fbbf24',
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    marginTop: 4,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(251, 191, 36, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  statsCard: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 18,
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  statValue: {
    color: '#6ee7b7',
    fontSize: 14,
    fontFamily: FONTS.displayBold,
  },
  tipBox: {
    width: '90%',
    marginTop: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    padding: 12,
  },
  tipTitle: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  tipBody: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17,
  },
  sectionLabel: {
    color: UI_COLORS.text,
    fontSize: 14,
    fontFamily: FONTS.displayBold,
    marginTop: 28,
    marginBottom: 12,
    alignSelf: 'flex-start',
    maxWidth: 340,
    width: '100%',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 340,
  },
  levelChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
  },
  levelChipCurrent: {
    borderColor: UI_COLORS.selected,
  },
  levelChipLocked: {
    opacity: 0.4,
  },
  levelChipNumber: {
    color: UI_COLORS.text,
    fontFamily: FONTS.displayBold,
    fontSize: 14,
  },
  levelChipScore: {
    color: '#6ee7b7',
    fontSize: 9,
    marginTop: 4,
  },
  actions: {
    width: '100%',
    maxWidth: 340,
    marginTop: 28,
    gap: 12,
  },
});
