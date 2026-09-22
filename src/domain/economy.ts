import type { CoinTransaction, PendingLevelReward, PlayerProgress, TransactionReason } from '../types/game';

export const GAME_ECONOMY = {
  hintCost: 50, undoCost: 30, shuffleCost: 25, reviveCost: 150,
  freeUndosPerLevel: 3, freeHintsPerLevel: 1,
  rapidTapGuardMs: 400,
} as const;

export function canAfford(coins: number, amount: number): boolean {
  return Number.isSafeInteger(coins) && Number.isSafeInteger(amount) && amount >= 0 && coins >= amount;
}
export interface TransactionResult {
  progress: PlayerProgress; applied: boolean; transaction?: CoinTransaction; message?: string;
}
// The ledger only needs to cover recent idempotency checks (retries of the current attempt's
// reward, a just-made purchase); anything older can never be re-submitted. Left unbounded, this
// dict (and the JSON it's serialized into on every persist flush) grows for the lifetime of a
// save and gets slower to stringify/write the longer someone has played — a real, worsening freeze.
const MAX_TRANSACTIONS = 300;
export function pruneTransactions(transactions: Record<string, CoinTransaction>): Record<string, CoinTransaction> {
  const entries = Object.entries(transactions);
  if (entries.length <= MAX_TRANSACTIONS) return transactions;
  entries.sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(entries.slice(0, MAX_TRANSACTIONS));
}
function transact(progress: PlayerProgress, amount: number, reason: TransactionReason, id: string, at: number): TransactionResult {
  if (!id || !Number.isSafeInteger(amount)) return { progress, applied: false, message: 'Invalid coin transaction.' };
  const existing = progress.transactions[id];
  if (existing) return { progress, applied: false, transaction: existing };
  const balanceAfter = progress.coins + amount;
  if (!Number.isSafeInteger(balanceAfter) || balanceAfter < 0) return { progress, applied: false, message: 'Insufficient coins or invalid balance.' };
  const transaction = { id, reason, amount, balanceBefore: progress.coins, balanceAfter, at };
  return { applied: true, transaction, progress: { ...progress, coins: balanceAfter,
    transactions: pruneTransactions({ ...progress.transactions, [id]: transaction }) } };
}
export function spendCoins(progress: PlayerProgress, amount: number, reason: TransactionReason, id: string, at = 0): TransactionResult {
  if (id && progress.transactions[id]) return { progress, applied: false, transaction: progress.transactions[id] };
  if (!canAfford(progress.coins, amount)) return { progress, applied: false, message: `Need ${amount} coins.` };
  return transact(progress, -amount, reason, id, at);
}
export function addCoins(progress: PlayerProgress, amount: number, reason: TransactionReason, id: string, at = 0): TransactionResult {
  if (!Number.isSafeInteger(amount) || amount < 0) return { progress, applied: false, message: 'Invalid coin amount.' };
  return transact(progress, amount, reason, id, at);
}
export const rewardTransactionId = (attemptId: string) => `reward:${attemptId}`;

/** Wallet, receipt, best result and unlock are returned as one atomic profile update. */
export function commitReward(progress: PlayerProgress, pending: PendingLevelReward, at = 0): TransactionResult {
  const result = addCoins(progress, pending.rewards.total, 'level_reward', rewardTransactionId(pending.attemptId), at);
  if (!result.applied) return result;
  const previous = progress.levelProgress[pending.levelId];
  const firstCompletion = !previous?.completed;
  const highestUnlockedLevel = Math.max(progress.highestUnlockedLevel, firstCompletion ? pending.levelId + 1 : 1);
  const bestStars = Math.max(previous?.bestStars ?? 0, pending.stars) as 1 | 2 | 3;
  return { ...result, progress: { ...result.progress, highestUnlockedLevel,
    unlockedLevels: [...new Set([...progress.unlockedLevels, ...(firstCompletion ? [pending.levelId + 1] : [])])],
    bestScore: Math.max(progress.bestScore, pending.score),
    levelsCompleted: progress.levelsCompleted + (firstCompletion ? 1 : 0),
    levelProgress: { ...progress.levelProgress, [pending.levelId]: {
      levelId: pending.levelId, completed: true, bestStars,
      bestMoves: Math.min(previous?.bestMoves ?? Infinity, pending.moves),
      bestPerfectFits: Math.max(previous?.bestPerfectFits ?? 0, pending.perfectFits),
      bestScore: Math.max(previous?.bestScore ?? 0, pending.score),
    } },
  } };
}
