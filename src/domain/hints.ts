import type { GameState, HintMove, Level } from '../types/game';
import { getSolutionFromState } from './levels/solver';

// Cache only gameplay-relevant values. Selection, feedback and wallet renders do not rerun search.
let cachedKey = '';
let cachedHint: HintMove | null = null;
export function getHintMove(state: GameState, level: Level, nodeLimit = 12000): HintMove | null {
  if (state.status !== 'playing') return null;
  const key = `${level.signature}|${nodeLimit}|${state.tubes.map(b => `${b.currentWeight}:${b.damage}`).join(',')}|${state.tray.map(b => b.id).sort().join(',')}`;
  if (key === cachedKey) return cachedHint;
  const result = getSolutionFromState(state, level, nodeLimit);
  const first = result.solution[0];
  cachedKey = key;
  cachedHint = first ? { ballId: first.weightId, tubeIndex: state.tubes.findIndex(b => b.id === first.bottleId) } : null;
  return cachedHint;
}
