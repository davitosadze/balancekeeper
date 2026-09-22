import type { GameState, Level, TutorialType } from '../../types/game';

const COPY: Record<TutorialType, string> = {
  drag: 'Drag a weight into the bottle to match its target.',
  combination: 'Combine weights to reach the target exactly.',
  'multiple-bottles': 'Every bottle needs its own exact combination.',
  choice: 'Plan the combinations together. A weight may fit in more than one bottle.',
  overload: 'Overloading damages bottles. The rejected weight stays in your tray.',
  durability: 'Normal glass can take two cracks. A third overload breaks it. You can still finish after a mistake.',
  combo: 'Useful placements build your combo. Milestones award a small bonus; thinking time never resets it.',
  'move-limit': 'Moves matter for stars. Meet the move goal for three stars; going over it does not end the level.',
  fragile: 'Fragile bottles break after one overload. Safe placements never damage them.',
  locked: 'Solve the bottle named on the lock to open it. Locked bottles cannot accept weights yet.',
};
/** Centralized lessons and event feedback; the screen contains no numbered-level rules. */
export function getTutorialMessage(level: Level, state: GameState): string | null {
  if (!level.tutorial || state.status !== 'playing') return null;
  if (state.currentEvent?.outcome === 'overload') return 'Overloading damages bottles. The weight was returned; you can still recover.';
  if (state.moves > 0 && !['durability','overload'].includes(level.tutorial.type)) return null;
  return level.tutorial.message ?? COPY[level.tutorial.type];
}
export function getMoveGoalText(level: Level, state: Pick<GameState,'moves'>): string | null {
  return level.rules.moveLimit == null ? null : `Moves ${state.moves} · Goal ${level.rules.moveLimit}`;
}
