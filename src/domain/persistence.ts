import type { GameState, Level } from '../types/game';
import { isLevelComplete } from '../utils/physics';
import { initialGame, refreshBottle } from './gameplay';

/** Ignore presentation feedback, but preserve the attempt and recovery/Undo history. */
let attemptKeys: string[] | undefined;
export function persistAttempt(state: GameState, level: Level): GameState {
  attemptKeys ??= Object.keys(initialGame(level));
  const attempt = Object.fromEntries(attemptKeys.map(key => [key, state[key as keyof GameState]])) as unknown as GameState;
  return { ...attempt, selectedBall: null, hintMove: null, currentEvent: null, invalidPlacement: null,
    floatingPoints: [], lastImpact: null, lastBreak: null, effects: [], effectSequence: 0 };
}
export function restoreAttempt(saved: GameState | undefined, level: Level): GameState | null {
  if (!saved || !saved.attemptId || saved.level !== level.id || !Array.isArray(saved.comboRewardEvents)) return null;
  // Finished rewards are immutable receipts, even when the next campaign changes geometry.
  if (saved.status === 'won' && saved.pendingLevelReward?.attemptId === saved.attemptId
    && saved.pendingLevelReward.levelId === saved.level && Array.isArray(saved.tubes) && isLevelComplete(saved.tubes)) {
    return persistAttempt(saved, level);
  }
  if (saved.levelSignature !== level.signature) return null;
  if (!['playing', 'won', 'lost'].includes(saved.status) || !Array.isArray(saved.tubes) || saved.tubes.length !== level.tubes.length) return null;
  const expected = new Map(level.tray.map(ball => [ball.id, ball.weight]));
  const balls = [...(saved.tray ?? []), ...saved.tubes.flatMap(tube => tube.balls ?? [])];
  if (balls.length !== expected.size || new Set(balls.map(ball => ball.id)).size !== expected.size
    || balls.some(ball => expected.get(ball.id) !== ball.weight)) return null;
  if (saved.tubes.some((tube, i) => tube.target !== level.tubes[i].target)) return null;
  return persistAttempt({ ...saved, tubes: saved.tubes.map(refreshBottle) }, level);
}

interface Storage {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<unknown>;
  removeItem(name: string): Promise<unknown>;
}

/** Serialization itself is deferred, not just the disk write. Transactions call flush. */
export function deferredJSONStorage<T>(storage: ReturnType<typeof orderedStorage>, delay = 250) {
  type Envelope = { state: T; version?: number };
  let pending: { name: string; value: Envelope } | undefined;
  let lastState: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onError: (() => void) | undefined;
  const drain = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    const next = pending; pending = undefined;
    storage.setItem(next.name, JSON.stringify(next.value));
  };
  return {
    getItem: async (name: string) => {
      const raw = await storage.getItem(name);
      return raw ? JSON.parse(raw) as Envelope : null;
    },
    setItem: (name: string, value: Envelope) => {
      if (value.state === lastState) return;
      lastState = value.state;
      pending = { name, value };
      // A bounded batch window also checkpoints continuous play.
      if (!timer) timer = setTimeout(() => { drain(); void storage.flush().catch(() => onError?.()); }, delay);
    },
    removeItem: (name: string) => {
      if (timer) clearTimeout(timer);
      timer = undefined; pending = undefined; lastState = undefined;
      return storage.removeItem(name);
    },
    flush: async () => { drain(); await storage.flush(); },
    retry: (name: string, value: Envelope) => { lastState = undefined; pending = { name, value }; },
    onError: (callback: () => void) => { onError = callback; },
  };
}
/** Serializes the existing storage writes so an older wallet snapshot cannot win a race. */
export function orderedStorage(storage: Storage) {
  let queue = Promise.resolve();
  let error: unknown;
  const enqueue = (operation: () => Promise<unknown>) => {
    queue = queue.then(operation).then(() => { error = undefined; }, failure => { error = failure; });
    return queue;
  };
  return {
    getItem: async (name: string) => { await queue; return storage.getItem(name); },
    setItem: (name: string, value: string) => enqueue(() => storage.setItem(name, value)),
    removeItem: (name: string) => enqueue(() => storage.removeItem(name)),
    flush: async () => { await queue; if (error) throw error; },
  };
}
