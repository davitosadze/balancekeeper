import { INTERSTITIAL_AFTER_REWARDED_COOLDOWN_MS, INTERSTITIAL_MIN_INTERVAL_MS } from './config';
import type { InterstitialPolicy } from './interstitialPolicy';
import type { InterstitialShowResult } from './interstitialController';
import type { AdStatus } from './rewardedController';

export interface AdStatusSource { getSnapshot: () => AdStatus; subscribe: (listener: () => void) => () => void }
export type InterstitialOutcome = 'shown' | 'not-due' | 'blocked' | 'not-ready' | 'failed' | 'unsupported';

/** Watches the rewarded controller so an interstitial never follows a rewarded ad closely. */
export class RewardedActivity {
  private lastEndedAt = -Infinity;
  constructor(private source: AdStatusSource, private now: () => number = Date.now) {
    let previous = source.getSnapshot();
    source.subscribe(() => {
      const current = source.getSnapshot();
      if (previous === 'showing' && current !== 'showing') this.lastEndedAt = this.now();
      previous = current;
    });
  }
  isActive = () => this.source.getSnapshot() === 'showing';
  sinceLast = () => this.now() - this.lastEndedAt;
}

interface GateDeps {
  policy: InterstitialPolicy;
  controller: { show: () => Promise<InterstitialShowResult>; preload: () => Promise<void> };
  rewarded: Pick<RewardedActivity, 'isActive' | 'sinceLast'>;
  supported: boolean;
  now?: () => number;
}

/** The only entry point the UI uses: count completions, then ask once at the Continue transition. */
export class InterstitialGate {
  private transitioning = false;
  private now: () => number;
  constructor(private deps: GateDeps) { this.now = deps.now ?? Date.now; }

  /**
   * Feed every observed attempt result here. Only a won attempt whose reward is saved can count;
   * failed attempts and replays of an already-completed level never advance the counter.
   * Safe to repeat for the same attempt.
   */
  recordLevelResult = (result: { status: string; rewardSaved: boolean; attemptId: string; isReplay: boolean }): Promise<boolean> =>
    result.status === 'won' && result.rewardSaved ? this.recordCompletion(result.attemptId, result.isReplay) : Promise.resolve(false);

  recordCompletion = async (attemptId: string, isReplay: boolean): Promise<boolean> => {
    if (!this.deps.supported) return false;
    try {
      const counted = await this.deps.policy.recordCompletion(attemptId, isReplay);
      void this.deps.controller.preload();
      return counted;
    } catch { return false; }
  };

  private blocked() {
    const { rewarded, policy } = this.deps;
    if (rewarded.isActive() || rewarded.sinceLast() < INTERSTITIAL_AFTER_REWARDED_COOLDOWN_MS) return true;
    const sinceInterstitial = this.now() - policy.getSnapshot().lastShownAt;
    return sinceInterstitial >= 0 && sinceInterstitial < INTERSTITIAL_MIN_INTERVAL_MS;
  }

  presentIfDue = async (): Promise<InterstitialOutcome> => {
    if (!this.deps.supported) return 'unsupported';
    try {
      // Claiming resets the counter before anything async, so a second call cannot show another ad.
      if (!await this.deps.policy.claimDue()) return 'not-due';
      if (this.blocked()) return 'blocked';
      const result = await this.deps.controller.show();
      if (result === 'closed') {
        await this.deps.policy.markShown(this.now());
        return 'shown';
      }
      return result === 'busy' ? 'blocked' : result;
    } catch { return 'failed'; }
  };

  /**
   * Runs the ad step, then `proceed` exactly once, whatever the ad did. Taps that arrive
   * while a transition is already running are ignored.
   */
  continueWith = async (proceed: () => void): Promise<boolean> => {
    if (this.transitioning) return false;
    this.transitioning = true;
    try {
      await this.presentIfDue();
      proceed();
    } finally { this.transitioning = false; }
    return true;
  };
}
