import type { Tube } from '../types/game';
import { calculateBottleWeight } from '../utils/physics';

export const STRESS_THRESHOLDS = { warning: .75, danger: .9 } as const;
export type BottleStress = 'safe' | 'warning' | 'danger' | 'overload';
export function getBottleStress(tube: Tube, attemptedWeight?: number): BottleStress {
  const ratio = (attemptedWeight ?? calculateBottleWeight(tube)) / tube.target;
  return ratio > 1 ? 'overload' : ratio >= STRESS_THRESHOLDS.danger ? 'danger'
    : ratio >= STRESS_THRESHOLDS.warning ? 'warning' : 'safe';
}
export function getComboFeedback(combo: number): { tier: number; label: string } | null {
  if (!Number.isSafeInteger(combo) || combo < 2) return null;
  const tier = Math.min(5, combo);
  return { tier, label: ({ 2: 'NICE!', 3: 'GREAT!', 4: 'AMAZING!', 5: 'BALANCE MASTER!' } as Record<number,string>)[tier] };
}
export const EFFECT_TIMING = { popup: 850, challenge: 1000, win: 900, winPulseStart: 360, winPulseStep: 75, result: 850, break: 550 } as const;
