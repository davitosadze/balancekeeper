import type { DamageStage, Tube } from '../types/game';

/** Damage is a mistake count, never a weight-, velocity-, or time-based HP loss. */
export function getBottleVisualState(bottle: Pick<Tube, 'damage' | 'durability'> & { isBroken?: boolean }): DamageStage {
  const damage = bottle.damage ?? 0;
  if (bottle.isBroken || (bottle.durability != null && damage >= bottle.durability)) return 'broken';
  if (damage >= 2) return 'cracked';
  if (damage === 1) return 'hairline';
  return 'pristine';
}
/** Compatibility for presentation components accepting remaining / max durability. */
export function getDamageStage(current: number, max: number): DamageStage {
  return getBottleVisualState({ damage: max - current, durability: max });
}
export function isCriticalDurability(current: number, max: number): boolean {
  return max > 0 && current > 0 && current <= 1;
}
