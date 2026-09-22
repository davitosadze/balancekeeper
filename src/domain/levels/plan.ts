import type { Difficulty, LevelMetadata, Mechanic } from '../../types/game';

const WAVES: Difficulty[] = [
  'easy','medium','medium','medium','hard','easy','medium','hard','hard','challenge',
  'tutorial','easy','medium','medium','hard','easy','medium','hard','hard','challenge',
  'tutorial','easy','medium','medium','hard','easy','medium','hard','hard','challenge',
  'tutorial','easy','medium','medium','challenge','easy','medium','hard','hard','challenge',
];
export function planLevel(id: number): LevelMetadata & { difficulty: Difficulty; name: string } {
  if (!Number.isInteger(id) || id < 11 || id > 50) throw new Error('Generated level id must be 11–50');
  const difficulty = WAVES[id - 11];
  const recovery = [11,16,26,36,46].includes(id);
  const mechanics: Mechanic[] = ['basic','overload','durability'];
  if (id >= 13) mechanics.push('combo');
  if (id >= 21) mechanics.push('move-goal');
  if ((id >= 31 && id <= 40 && !recovery) || id >= 47) mechanics.push('fragile');
  if (id >= 41 && !recovery) mechanics.push('locked');
  const tutorial = id === 13 ? { type: 'combo' as const, step: 1 }
    : id === 21 ? { type: 'move-limit' as const, step: 1 }
    : id === 31 ? { type: 'fragile' as const, step: 1 }
    : id === 41 ? { type: 'locked' as const, step: 1 } : undefined;
  const milestone = id % 10 === 0 ? { title: id === 50 ? 'BALANCE MASTER' : `MILESTONE ${id}`,
    completionMessage: id === 50 ? 'Every skill, perfectly balanced. The first campaign is complete.' : 'A new milestone in perfect balance.' } : undefined;
  return { difficulty, mechanics, tutorial, milestone,
    kind: milestone ? 'milestone' : tutorial ? 'tutorial' : recovery ? 'recovery' : 'standard',
    name: id === 21 ? 'Make Every Move Count' : id === 31 ? 'Handle with Care' : id === 41 ? 'The First Key'
      : id === 50 ? 'The Balance Master' : milestone ? `Milestone ${id}` : recovery ? 'Room to Breathe'
      : id === 13 ? 'Find Your Rhythm' : mechanics.includes('locked') ? 'Order and Balance'
      : mechanics.includes('fragile') ? 'Delicate Balance' : difficulty === 'hard' ? 'A Closer Balance' : 'Pieces in Place',
  };
}
