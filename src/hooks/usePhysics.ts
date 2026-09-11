import { useMemo } from 'react';
import type { Tube } from '@/types/game';
import { bottleWeight, isBottleComplete, canPlaceBall } from '@/utils/physics';

export interface TubePhysics {
  weight: number;
  isComplete: boolean;
}

/**
 * Computes and memoizes physics readouts (current weight, completion) for
 * every tube on the board, plus a canPlaceBall helper bound to the current
 * board state. Recomputes only when the tubes array reference changes.
 * @param tubes - The current board's tubes.
 */
export function usePhysics(tubes: Tube[]) {
  const tubePhysics = useMemo<TubePhysics[]>(
    () =>
      tubes.map((tube) => ({
        weight: bottleWeight(tube),
        isComplete: isBottleComplete(tube),
      })),
    [tubes]
  );

  const canPlaceBallIn = useMemo(
    () => (tubeIndex: number, ballWeight: number) => canPlaceBall(tubes[tubeIndex], ballWeight),
    [tubes]
  );

  return { tubePhysics, canPlaceBall: canPlaceBallIn };
}
