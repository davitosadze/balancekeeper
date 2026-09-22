import type { LevelConfig } from '../../types/game';

/** Three hand-authored engine fixtures; this is not the production progression. */
export const PHASE1_LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 1, name: 'Exact Fit', difficulty: 'easy',
    bottles: [{ id: 'b1', target: 5, durability: 3, type: 'normal' }],
    weights: [{ id: 'w1', value: 5, color: 'green', type: 'normal' }],
    rules: { allowUndo: true, allowHint: true },
    rewards: { baseCoins: 40, perfectFitCoins: 10, comboMilestones: { 2: 2, 3: 4, 4: 6, 5: 10 }, threeStarBonus: 25 },
    stars: { twoStarMaxMoves: 2, threeStarMaxMoves: 1 },
  },
  {
    id: 2, name: 'Two Together', difficulty: 'easy',
    bottles: [{ id: 'b1', target: 5, durability: 3, type: 'normal' }],
    weights: [
      { id: 'w1', value: 2, color: 'blue', type: 'normal' },
      { id: 'w2', value: 3, color: 'yellow', type: 'normal' },
    ],
    rules: { allowUndo: true, allowHint: true },
    rewards: { baseCoins: 40, perfectFitCoins: 10, comboMilestones: { 2: 2, 3: 4, 4: 6, 5: 10 }, threeStarBonus: 25 },
    stars: { twoStarMaxMoves: 3, threeStarMaxMoves: 2 },
  },
  {
    id: 3, name: 'Find the Balance', difficulty: 'medium',
    bottles: [
      { id: 'b1', target: 5, durability: 3, type: 'normal' },
      { id: 'b2', target: 8, durability: 3, type: 'normal' },
    ],
    weights: [
      { id: 'w1', value: 2, color: 'blue', type: 'normal' },
      { id: 'w2', value: 3, color: 'yellow', type: 'normal' },
      { id: 'w3', value: 3, color: 'green', type: 'normal' },
      { id: 'w4', value: 5, color: 'red', type: 'normal' },
    ],
    rules: { allowUndo: true, allowHint: true },
    rewards: { baseCoins: 60, perfectFitCoins: 10, comboMilestones: { 2: 2, 3: 4, 4: 6, 5: 10 }, threeStarBonus: 25 },
    stars: { twoStarMaxMoves: 6, threeStarMaxMoves: 4 },
  },
];
