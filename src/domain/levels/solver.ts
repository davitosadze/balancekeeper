import type { Ball, BottleState, GameState, Level, SolutionMove, Tube } from '../../types/game';
import { calculateBottleWeight } from '../../utils/physics';

export interface SolverState { bottles: readonly Tube[]; tray: readonly Ball[] }
export interface SolverResult {
  solvable: boolean | null;
  minimumMoves: number | null;
  solution: SolutionMove[];
  status: 'solved' | 'unsolvable' | 'limit';
  nodes: number;
}
const MAX_BALLS = 18;
const DEFAULT_NODE_LIMIT = 100000;

/** Exact minimum remaining placements. No coins, history, time or animations enter search.
 * Positive weights permit pruning above-target placements and completing one eligible
 * bottle at a time: other bottles cannot enable it except by solving prerequisites.
 * Equal-value weight identities are interchangeable; paths retain concrete IDs. */
export function solveLevel(level: Level, state: SolverState = { bottles: level.tubes, tray: level.tray }, nodeLimit = DEFAULT_NODE_LIMIT): SolverResult {
  const impossible = (): SolverResult => ({ solvable: false, minimumMoves: null, solution: [], status: 'unsolvable', nodes: 0 });
  if (!state.bottles.length || state.bottles.some(b => calculateBottleWeight(b) > b.target
    || (b.durability != null && (b.damage ?? 0) >= b.durability))) return impossible();
  if (state.tray.some(b => !Number.isSafeInteger(b.weight) || b.weight <= 0)) return impossible();
  if (state.tray.length > MAX_BALLS || nodeLimit < 1) return { ...impossible(), solvable: null, status: 'limit' };
  const bottles = state.bottles;
  const remaining = bottles.map(b => b.target - calculateBottleWeight(b));
  const dependencies = bottles.map(b => b.type === 'locked' ? bottles.findIndex(other => other.id === b.unlockAfter) : -2);
  if (dependencies.includes(-1)) return impossible();
  const balls = [...state.tray].sort((a,b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const memo = new Map<string, SolutionMove[] | null>();
  let nodes = 0, limited = false;
  function search(deficits: number[], available: Ball[]): SolutionMove[] | null {
    if (++nodes > nodeLimit) { limited = true; return null; }
    if (deficits.every(value => value === 0)) return [];
    if (available.reduce((sum,b) => sum + b.weight, 0) < deficits.reduce((a,b) => a+b,0)) return null;
    const key = `${deficits.join(',')}|${available.map(b => b.weight).join(',')}`;
    const cached = memo.get(key);
    if (memo.has(key)) {
      // Remap cached equal-value moves to this branch's concrete remaining IDs.
      if (!cached) return null;
      const pool = [...available];
      return cached.map(move => {
        const value = balls.find(b => b.id === move.weightId)!.weight;
        const i = pool.findIndex(b => b.weight === value);
        return { weightId: pool.splice(i,1)[0].id, bottleId: move.bottleId };
      });
    }
    const index = deficits.map((need,i) => ({ need, i }))
      .filter(({need,i}) => need > 0 && (dependencies[i] === -2 || deficits[dependencies[i]] === 0))
      .sort((a,b) => a.need - b.need || a.i-b.i)[0]?.i;
    if (index == null) return null;
    let best: SolutionMove[] | null = null;
    const tried = new Set<number>();
    for (let i=0;i<available.length;i++) {
      const ball = available[i];
      if (tried.has(ball.weight) || ball.weight > deficits[index]) continue;
      tried.add(ball.weight);
      const next = [...deficits]; next[index] -= ball.weight;
      const tail = search(next, available.filter((_,j) => j !== i));
      if (tail && (!best || tail.length + 1 < best.length)) best = [{ weightId: ball.id, bottleId: bottles[index].id ?? `b${index+1}` }, ...tail];
      if (limited) return best;
    }
    memo.set(key, best); return best;
  }
  const solution = search(remaining, balls);
  if (limited) return { status: 'limit', solvable: solution ? true : null, minimumMoves: null, solution: solution ?? [], nodes };
  return { status: solution ? 'solved' : 'unsolvable', solvable: !!solution, minimumMoves: solution?.length ?? null, solution: solution ?? [], nodes };
}
export function getSolutionFromState(state: Pick<GameState, 'tubes' | 'tray' | 'status'>, level: Level, nodeLimit = 12000): SolverResult {
  if (state.status === 'lost') return { solvable: false, minimumMoves: null, solution: [], status: 'unsolvable', nodes: 0 };
  return solveLevel(level, { bottles: state.tubes as BottleState[], tray: state.tray }, nodeLimit);
}
