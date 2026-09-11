import type { Tube } from '@/types/game';
import { TUBE_CAPACITY, DEFAULT_UNLOCK_AFTER_COMPLETIONS } from './constants';

/**
 * Sums the weight (kg) of every ball currently in a bottle.
 * @param tube - The bottle to evaluate.
 * @returns Total weight in kg.
 */
export function bottleWeight(tube: Tube): number {
  if (!tube) return 0;
  return tube.balls.reduce((sum, ball) => sum + ball.weight, 0);
}

/**
 * A bottle is complete when its balls sum to exactly its target weight.
 * @param tube - The bottle to evaluate.
 * @returns Whether the bottle is exactly full.
 */
export function isBottleComplete(tube: Tube): boolean {
  return bottleWeight(tube) === tube.target;
}

/**
 * Locked-bottle gimmick: a tube listed in lockedTubes stays locked (cannot
 * receive balls) until enough other tubes have been completed.
 * @param tubeIndex - The tube to check.
 * @param lockedTubes - Tube indices that start locked for this level.
 * @param completedCount - How many tubes have been completed so far.
 * @param unlockAfterCompletions - Completions needed to unlock (default 1).
 * @returns Whether the tube is currently locked.
 */
export function isTubeLocked(
  tubeIndex: number,
  lockedTubes: number[] | undefined,
  completedCount: number,
  unlockAfterCompletions: number = DEFAULT_UNLOCK_AFTER_COMPLETIONS
): boolean {
  if (!lockedTubes || !lockedTubes.includes(tubeIndex)) return false;
  return completedCount < unlockAfterCompletions;
}

/** Lock-state context passed to canPlaceBall so it can reject locked bottles. */
export interface LockState {
  lockedTubes: number[];
  completedCount: number;
  unlockAfterCompletions?: number;
}

/**
 * Determines whether a ball can legally be placed into a bottle.
 * Rules:
 *  - The bottle may not be locked (see isTubeLocked).
 *  - The bottle must have a free slot (< TUBE_CAPACITY balls).
 *  - The bottle's current weight plus the ball's weight must not exceed its target.
 * @param tube - The destination bottle.
 * @param ballWeight - Weight (kg) of the ball being placed.
 * @param lockState - Optional locked-bottle context for this level.
 * @param tubeIndex - Index of the destination bottle, required when lockState is given.
 * @returns Whether the placement is valid.
 */
export function canPlaceBall(tube: Tube, ballWeight: number, lockState?: LockState, tubeIndex?: number): boolean {
  if (!tube) return false;

  if (lockState && tubeIndex !== undefined) {
    const { lockedTubes, completedCount, unlockAfterCompletions } = lockState;
    if (isTubeLocked(tubeIndex, lockedTubes, completedCount, unlockAfterCompletions)) return false;
  }

  if (tube.balls.length >= TUBE_CAPACITY) return false;

  return bottleWeight(tube) + ballWeight <= tube.target;
}
