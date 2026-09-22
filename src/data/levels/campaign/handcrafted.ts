import { fromSolution } from '../../../domain/levels/authoring';
import type { LevelConfig } from '../../../types/game';

/** Ten reviewed lessons; no PRNG is used for the opening campaign. */
export const HANDCRAFTED_LEVELS: LevelConfig[] = [
  fromSolution(1, 'tutorial', [[5]], {
    name: 'Your First Balance', baseCoins: 25, source: 'handcrafted', kind: 'tutorial', mechanics: ['basic'],
    tutorial: { type: 'drag', step: 1, message: 'Drag the 5 kg weight into the bottle to match its target.' },
  }),
  fromSolution(2, 'tutorial', [[3,5]], {
    name: 'Better Together', baseCoins: 25, source: 'handcrafted', kind: 'tutorial', mechanics: ['basic'],
    tutorial: { type: 'combination', step: 1, message: 'Combine 3 kg and 5 kg to reach the 8 kg target.' },
  }),
  fromSolution(3, 'tutorial', [[2,3],[4,5]], {
    name: 'Two Bottles', baseCoins: 30, source: 'handcrafted', kind: 'tutorial', mechanics: ['basic'],
    tutorial: { type: 'multiple-bottles', step: 1, message: 'Match both targets: 5 kg on the left, 9 kg on the right.' },
  }),
  fromSolution(4, 'easy', [[2,5],[3,8]], {
    name: 'Choose Your Pair', baseCoins: 40, source: 'handcrafted', kind: 'tutorial', mechanics: ['basic'],
    tutorial: { type: 'choice', step: 1, message: 'Plan both pairs before placing them. Undo can help you try again.' },
  }),
  fromSolution(5, 'easy', [[2,4],[3,5],[4,6]], {
    name: 'Three in Harmony', baseCoins: 50, source: 'handcrafted', kind: 'tutorial', mechanics: ['basic'],
    tutorial: { type: 'multiple-bottles', step: 2, message: 'Three bottles, three targets. Take your time and find each combination.' },
  }),
  fromSolution(6, 'tutorial', [[4,6],[3,8]], {
    name: 'Steady Hands', baseCoins: 30, source: 'handcrafted', kind: 'tutorial', mechanics: ['basic'],
    tutorial: { type: 'choice', step: 2, message: 'Every bottle has one exact weight to reach — plan before you drop.' },
  }),
  fromSolution(7, 'easy', [[2,6],[4,7]], {
    name: 'Every Gram Counts', baseCoins: 55, source: 'handcrafted', kind: 'standard', mechanics: ['basic'],
    tutorial: { type: 'multiple-bottles', step: 3, message: 'There is no room for extra weight — match each target exactly.' },
  }),
  fromSolution(8, 'tutorial', [[2,3],[4,6]], {
    name: 'The First Crack', baseCoins: 30, distractors: [9], source: 'handcrafted', kind: 'tutorial', mechanics: ['basic','overload'],
    tutorial: { type: 'overload', step: 1, message: 'Overloading damages bottles. The 9 kg weight exceeds the left bottle’s 5 kg target; a first crack is recoverable.' },
  }),
  fromSolution(9, 'easy', [[3,5],[2,7]], {
    name: 'Glass Has Limits', baseCoins: 60, distractors: [12], source: 'handcrafted', kind: 'tutorial', mechanics: ['basic','overload','durability'],
    tutorial: { type: 'durability', step: 1 },
  }),
  fromSolution(10, 'challenge', [[2,7],[4,8],[6,10]], {
    name: 'The First Challenge', baseCoins: 150, distractors: [5], source: 'handcrafted', kind: 'milestone',
    mechanics: ['basic','overload','durability','combo'],
    milestone: { title: 'FIRST CHALLENGE COMPLETE', completionMessage: 'Three bottles. One perfect balance. Your first milestone is complete.' },
  }),
];
// Opening lessons have no paid-action requirement, move goal, or forced mistake.
for (const level of HANDCRAFTED_LEVELS) {
  if (level.id <= 3) level.rules = { ...level.rules, allowShuffle: false, freeHints: 1, freeUndos: 3 };
}
