import type { Tube } from '../types/game';

export function calculateBottleWeight(tube: Tube): number {
  return tube?.balls.reduce((sum, ball) => sum + ball.weight, 0) ?? 0;
}
export const bottleWeight = calculateBottleWeight;
export function isBottleSolved(tube: Tube): boolean { return bottleWeight(tube) === tube.target; }
export const isBottleComplete = isBottleSolved;
export function isLevelComplete(tubes: Tube[]): boolean { return tubes.length > 0 && tubes.every(isBottleSolved); }
/** Locks are derived from the referenced bottle, never a global solved count. */
export function isBottleLocked(tube: Tube, bottles: readonly Tube[]): boolean {
  if (tube.type !== 'locked') return false;
  const prerequisite = bottles.find(bottle => bottle.id === tube.unlockAfter);
  return !prerequisite || !isBottleSolved(prerequisite)
    || (prerequisite.durability != null && (prerequisite.damage ?? 0) >= prerequisite.durability);
}
export function getLockedBottleIndices(bottles: readonly Tube[]): number[] {
  return bottles.filter(bottle => isBottleLocked(bottle, bottles)).map(bottle => bottle.index);
}
export interface LockState { bottles: readonly Tube[] }
/** Foundation for any future removal UI. Undo restores snapshots independently. */
export function canManuallyRemoveBall(tube: Tube, weightId: string): boolean {
  return !!tube && !['oneWay', 'one-way'].includes(tube.type ?? 'normal')
    && !((tube.damage ?? 0) >= (tube.durability ?? (tube.type === 'fragile' ? 1 : 3)))
    && tube.balls.some(ball => ball.id === weightId);
}
export type PlacementRejectionReason = 'locked' | 'broken' | 'invalid' | 'overload' | 'exact';
export function getRejectionReason(tube: Tube, ballWeight: number, lockState?: LockState, tubeIndex?: number): PlacementRejectionReason | null {
  if (!tube || !Number.isFinite(ballWeight) || ballWeight <= 0) return 'invalid';
  if (!['normal','fragile','locked','exact','oneWay','one-way'].includes(tube.type ?? 'normal')) return 'invalid';
  if ((tube.damage ?? 0) >= (tube.durability ?? (tube.type === 'fragile' ? 1 : 3))) return 'broken';
  // A caller must provide the board when evaluating a referenced lock.
  if (tube.type === 'locked' && (!lockState || isBottleLocked(tube, lockState.bottles))) return 'locked';
  if (tube.type === 'exact' && bottleWeight(tube) + ballWeight > tube.target) return tube.damageOnOverload ? 'overload' : 'exact';
  return bottleWeight(tube) + ballWeight > tube.target ? 'overload' : null;
}
export function evaluateDrop(tube: Tube, ballWeight: number, lockState?: LockState, tubeIndex?: number) {
  const reason = getRejectionReason(tube, ballWeight, lockState, tubeIndex);
  const nextWeight = bottleWeight(tube) + ballWeight;
  return { accepted: reason === null, reason, nextWeight, perfectFit: reason === null && nextWeight === tube.target };
}
export function canPlaceBall(tube: Tube, ballWeight: number, lockState?: LockState, tubeIndex?: number) {
  return getRejectionReason(tube, ballWeight, lockState, tubeIndex) === null;
}
