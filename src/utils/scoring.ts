/** Points awarded for a single valid ball placement. */
const POINTS_PER_PLACEMENT = 10;

/** Bonus points awarded when a bottle is filled to exactly its target weight. */
const BOTTLE_COMPLETE_BONUS = 250;

/** Bonus points awarded when an entire level is completed. */
const LEVEL_COMPLETE_BONUS = 1000;

/** Bonus points awarded per remaining move at level completion. */
const POINTS_PER_REMAINING_MOVE = 100;

/**
 * Points awarded for a single valid ball placement.
 * @returns 10
 */
export function calculatePlacementPoints(): number {
  return POINTS_PER_PLACEMENT;
}

/**
 * Bonus points awarded for filling a bottle to exactly its target weight.
 * @returns 250
 */
export function calculateBottleCompleteBonus(): number {
  return BOTTLE_COMPLETE_BONUS;
}

/**
 * Flat bonus points awarded for finishing a level.
 * @returns 1000
 */
export function calculateLevelBonus(): number {
  return LEVEL_COMPLETE_BONUS;
}

/**
 * Bonus points scaled by the number of moves left unused at completion.
 * @param remainingMoves - Moves left when the level was completed.
 * @returns remainingMoves * 100
 */
export function calculateMoveBonus(remainingMoves: number): number {
  return Math.max(0, remainingMoves) * POINTS_PER_REMAINING_MOVE;
}

/**
 * Determines star rating (1-3) earned for a level based on moves used vs. minMoves.
 * 3 stars: used <= minMoves. 2 stars: used <= minMoves * 1.5. 1 star: completed at all.
 * @param movesUsed - Moves consumed to complete the level.
 * @param minMoves - The level's optimal move count.
 * @returns Star rating from 1-3.
 */
export function calculateStars(movesUsed: number, minMoves: number): 1 | 2 | 3 {
  if (movesUsed <= minMoves) return 3;
  if (movesUsed <= Math.ceil(minMoves * 1.5)) return 2;
  return 1;
}
