import { INTERSTITIAL_COMPLETION_INTERVAL } from './config';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}
export interface InterstitialState {
  /** New level completions since the last interstitial opportunity. */
  completions: number;
  /** Makes recording idempotent when the same finished attempt is restored after a restart. */
  lastCountedAttemptId: string | null;
  lastShownAt: number;
}
const INITIAL: InterstitialState = { completions: 0, lastCountedAttemptId: null, lastShownAt: 0 };
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function restoreInterstitialState(raw: string | null): InterstitialState {
  try {
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== 'object') return INITIAL;
    return { completions: count(saved.completions),
      lastCountedAttemptId: typeof saved.lastCountedAttemptId === 'string' ? saved.lastCountedAttemptId : null,
      lastShownAt: count(saved.lastShownAt) };
  } catch { return INITIAL; }
}

/**
 * Frequency bookkeeping only. It knows nothing about the game store, and a failing disk never
 * blocks the player: state stays authoritative in memory and persistence is best-effort.
 * Operations are serialized so a completion recorded just before Continue is always counted.
 */
export class InterstitialPolicy {
  private state = INITIAL;
  private queue: Promise<unknown>;
  constructor(private storage: KeyValueStorage, private key: string, private interval = INTERSTITIAL_COMPLETION_INTERVAL) {
    this.queue = storage.getItem(key).then(raw => { this.state = restoreInterstitialState(raw); }, () => {});
  }
  private run<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  private async commit(next: InterstitialState) {
    this.state = next;
    try { await this.storage.setItem(this.key, JSON.stringify(next)); } catch { /* Best-effort. */ }
  }
  getSnapshot = () => this.state;

  /** Only a first-time completion counts; a replay of an already-completed level never does. */
  recordCompletion = (attemptId: string, isReplay: boolean): Promise<boolean> => this.run(async () => {
    if (isReplay || this.state.lastCountedAttemptId === attemptId) return false;
    await this.commit({ ...this.state, completions: this.state.completions + 1, lastCountedAttemptId: attemptId });
    return true;
  });
  /** Takes the opportunity: the counter resets whether or not an ad can actually be shown. */
  claimDue = (): Promise<boolean> => this.run(async () => {
    if (this.state.completions < this.interval) return false;
    await this.commit({ ...this.state, completions: 0 });
    return true;
  });
  markShown = (at: number): Promise<void> => this.run(() => this.commit({ ...this.state, lastShownAt: count(at) }));
}
