import type { GameState, Level, RewardBreakdown, StarConfig } from '../types/game';

export function calculateStars(attempt: Pick<GameState, 'status' | 'moves' | 'mistakes' | 'undoUsed' | 'hintUsed'>, rules: StarConfig): 0 | 1 | 2 | 3 {
  if (attempt.status !== 'won') return 0;
  const clean = attempt.mistakes === 0 && attempt.undoUsed === 0 && attempt.hintUsed === 0;
  if (clean && attempt.moves <= rules.threeStarMaxMoves) return 3;
  return attempt.moves <= rules.twoStarMaxMoves ? 2 : 1;
}
export function comboLabel(combo: number): string | null {
  if (combo >= 5) return 'Balance Master!';
  return ({ 2: 'Nice!', 3: 'Great!', 4: 'Amazing!' } as Record<number, string>)[combo] ?? null;
}
/** Each milestone pays once per attempt; Undo rewinds the event list. */
export function calculateRewards(state: Pick<GameState, 'perfectFits' | 'comboRewardEvents' | 'status' | 'isReplay'>, level: Pick<Level, 'rewards' | 'tubes'>, stars: number): RewardBreakdown {
  const won = state.status === 'won';
  const baseCoins = won && !state.isReplay ? level.rewards.baseCoins : 0;
  const perfectFitCoins = Math.min(state.perfectFits, level.tubes.length) * level.rewards.perfectFitCoins;
  const milestones = new Set(state.comboRewardEvents.map(event => event.milestone));
  const comboBonus = [...milestones].reduce((sum, milestone) => sum + (level.rewards.comboMilestones[milestone] ?? 0), 0);
  const threeStarBonus = won && stars === 3 ? level.rewards.threeStarBonus : 0;
  return { baseCoins, perfectFitCoins, comboBonus, threeStarBonus, total: baseCoins + perfectFitCoins + comboBonus + threeStarBonus };
}
