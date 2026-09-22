import type { Difficulty, Mechanic } from '../../types/game';

export const LEVEL_GENERATION_VERSION = 1;
export const CAMPAIGN_SIZE = 50;
type Range = readonly [number, number];
export interface DifficultyProfile {
  bottles: Range; solutionBalls: Range; target: Range;
  distractors: Range; durability: Range; baseCoins: Range;
  threeStarSlack: number; twoStarSlack: number; recommendedMoveSlack: number;
  allowedMechanics: readonly Mechanic[]; minimumDifficultyScore: number;
}
const basic: Mechanic[] = ['basic', 'overload', 'durability', 'combo', 'move-goal'];
export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  tutorial: { bottles: [2,2], solutionBalls: [4,4], target: [6,14], distractors: [0,0], durability: [3,3], baseCoins: [25,30], threeStarSlack: 1, twoStarSlack: 2, recommendedMoveSlack: 2, allowedMechanics: [...basic,'fragile','locked'], minimumDifficultyScore: 0 },
  easy: { bottles: [2,3], solutionBalls: [4,6], target: [6,16], distractors: [0,1], durability: [3,3], baseCoins: [40,60], threeStarSlack: 1, twoStarSlack: 2, recommendedMoveSlack: 2, allowedMechanics: [...basic,'fragile','locked'], minimumDifficultyScore: 0 },
  medium: { bottles: [3,4], solutionBalls: [6,8], target: [10,22], distractors: [0,2], durability: [3,3], baseCoins: [60,90], threeStarSlack: 0, twoStarSlack: 3, recommendedMoveSlack: 3, allowedMechanics: [...basic,'fragile','locked'], minimumDifficultyScore: 10 },
  hard: { bottles: [4,5], solutionBalls: [8,11], target: [13,26], distractors: [1,3], durability: [2,3], baseCoins: [90,130], threeStarSlack: 0, twoStarSlack: 3, recommendedMoveSlack: 3, allowedMechanics: [...basic,'fragile','locked'], minimumDifficultyScore: 22 },
  challenge: { bottles: [4,5], solutionBalls: [8,11], target: [14,28], distractors: [1,2], durability: [2,3], baseCoins: [150,250], threeStarSlack: 0, twoStarSlack: 3, recommendedMoveSlack: 3, allowedMechanics: [...basic,'fragile','locked'], minimumDifficultyScore: 26 },
};
