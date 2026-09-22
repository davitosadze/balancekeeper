import { restoreCosmetics } from './cosmetics/inventory';
import { pruneTransactions } from './economy';
import type { LevelProgress, PlayerProgress } from '../types/game';

export const INITIAL_PROGRESS: PlayerProgress = {
  ...restoreCosmetics(),
  coins: 0, highestUnlockedLevel: 1, unlockedLevels: [1], levelProgress: {}, transactions: {},
  bestScore: 0, levelsCompleted: 0, totalPlaytimeSeconds: 0,
};
/** Both previous raw saves and the existing Zustand envelope use this one key. */
export function migrateProgressStorage(raw: string | null): string | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value && !value.state && ('coins' in value || Array.isArray(value.unlockedLevels))) {
    return JSON.stringify({ state: { progress: value }, version: 0 });
  }
  return raw;
}
const nonnegative = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
export function restoreProgress(saved: Partial<PlayerProgress> | undefined, initial = INITIAL_PROGRESS): PlayerProgress {
  if (!saved) return initial;
  const levelProgress: Record<number, LevelProgress> = {};
  for (const [key, raw] of Object.entries(saved.levelProgress ?? {})) {
    const value = raw as Partial<LevelProgress> & { stars?: number };
    const levelId = nonnegative(Number(key));
    if (!levelId || !value) continue;
    levelProgress[levelId] = {
      levelId, completed: !!value.completed, bestStars: Math.min(3, nonnegative(value.bestStars ?? value.stars)) as LevelProgress['bestStars'],
      bestMoves: value.bestMoves == null ? null : nonnegative(value.bestMoves),
      bestScore: nonnegative(value.bestScore), bestPerfectFits: nonnegative(value.bestPerfectFits),
    };
  }
  const unlockedLevels = [...new Set([1, ...(saved.unlockedLevels ?? []).filter(id => nonnegative(id) > 0)])];
  const highestUnlockedLevel = Math.max(1, nonnegative(saved.highestUnlockedLevel), ...unlockedLevels,
    ...Object.values(levelProgress).filter(level => level.completed).map(level => level.levelId + 1));
  return { ...initial, ...restoreCosmetics(saved, saved.transactions ?? {}), coins: nonnegative(saved.coins), highestUnlockedLevel, unlockedLevels, levelProgress,
    transactions: pruneTransactions(saved.transactions ?? {}), bestScore: nonnegative(saved.bestScore),
    levelsCompleted: Math.max(nonnegative(saved.levelsCompleted), Object.values(levelProgress).filter(level => level.completed).length),
    totalPlaytimeSeconds: nonnegative(saved.totalPlaytimeSeconds),
  };
}
