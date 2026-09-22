import type { BallColor, Difficulty, LevelConfig, LevelMetadata } from '../../types/game';
import { DEFAULT_REWARDS, DEFAULT_RULES } from '../levelConfig';
import { LEVEL_GENERATION_VERSION } from './profiles';

const COLORS: BallColor[] = ['blue','green','yellow','red','purple','cyan'];
/** Solution groups are authored before targets; distractors never alter the witness. Each
 * bottle's target is the sum of its solution group — the single value the player must reach
 * exactly, and the point at which any further weight overloads the bottle. */
export function fromSolution(id: number, difficulty: Difficulty, groups: number[][],
  options: LevelMetadata & { name: string; baseCoins: number; distractors?: number[] }): LevelConfig {
  let weightIndex = 0;
  const weights: LevelConfig['weights'] = [];
  const intendedSolution: NonNullable<LevelConfig['intendedSolution']> = [];
  const bottles = groups.map((values, i) => {
    const id = `b${i+1}`;
    values.forEach(value => {
      const weightId = `w${++weightIndex}`;
      weights.push({ id: weightId, value, color: COLORS[(weightIndex-1) % COLORS.length], type: 'normal' });
      intendedSolution.push({ weightId, bottleId: id });
    });
    return { id, target: values.reduce((a,b) => a+b,0), durability: 3, type: 'normal' as const };
  });
  for (const value of options.distractors ?? []) {
    weights.push({ id: `w${++weightIndex}`, value, color: COLORS[(weightIndex-1) % COLORS.length], type: 'normal' });
  }
  const { baseCoins, distractors: _, ...metadata } = options;
  return { ...metadata, id, difficulty, generationVersion: LEVEL_GENERATION_VERSION,
    bottles, weights, intendedSolution, rules: { ...DEFAULT_RULES }, rewards: { ...DEFAULT_REWARDS, baseCoins },
    stars: { threeStarMaxMoves: intendedSolution.length, twoStarMaxMoves: intendedSolution.length + 2 },
    recommendedMoves: intendedSolution.length + 2 };
}
