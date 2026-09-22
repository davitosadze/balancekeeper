import { AD_LOAD_TIMEOUT_MS, AD_MAX_AGE_MS, AD_RETRY_DELAY_MS, INTERSTITIAL_OPEN_TIMEOUT_MS } from './config';
import type { AdStatus } from './rewardedController';

export type InterstitialEvent = 'loaded' | 'opened' | 'closed' | 'error';
export interface InterstitialHandle {
  listen: (event: InterstitialEvent, listener: () => void) => () => void;
  load: () => void;
  show: () => Promise<unknown>;
  destroy: () => void;
}
export interface InterstitialAdapter {
  initialize: () => Promise<boolean>;
  create: () => InterstitialHandle;
}
/** `closed` is the only result where the player actually saw an ad. Every result lets the caller continue. */
export type InterstitialShowResult = 'closed' | 'not-ready' | 'busy' | 'failed';

/** App-scoped preloaded interstitial. show() never waits for a load and always settles. */
export class InterstitialController {
  private status: AdStatus = 'idle';
  private subscribers = new Set<() => void>();
  private ad: InterstitialHandle | null = null;
  private listeners: (() => void)[] = [];
  private loadTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private openTimer?: ReturnType<typeof setTimeout>;
  private presentation: ((result: InterstitialShowResult) => void) | null = null;
  private generation = 0;
  private loadedAt = 0;
  private retryAt = 0;
  private automaticRetries = 0;
  private disposed = false;
  private suspended = false;

  constructor(private adapter: InterstitialAdapter, private loadTimeout = AD_LOAD_TIMEOUT_MS,
    private openTimeout = INTERSTITIAL_OPEN_TIMEOUT_MS) {}
  getSnapshot = (): AdStatus => this.status;
  subscribe = (listener: () => void) => {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  };
  private update(status: AdStatus) {
    this.status = status;
    this.subscribers.forEach(listener => listener());
  }

  preload = async (): Promise<void> => {
    if (this.disposed || this.suspended || this.status === 'showing' || this.status === 'loading') return;
    if (this.status === 'ready' && Date.now() - this.loadedAt < AD_MAX_AGE_MS) return;
    if (Date.now() < this.retryAt) return;
    this.releaseAd();
    const generation = ++this.generation;
    this.update('loading');
    this.loadTimer = setTimeout(() => this.failLoad(generation), this.loadTimeout);
    try {
      if (!await this.adapter.initialize()) {
        this.failLoad(generation);
        return;
      }
      if (generation !== this.generation || this.disposed || this.suspended) return;
      const ad = this.adapter.create();
      this.ad = ad;
      const listen = (event: InterstitialEvent, callback: () => void) => {
        this.listeners.push(ad.listen(event, () => {
          if (this.ad === ad && generation === this.generation) callback();
        }));
      };
      listen('loaded', () => {
        if (this.status !== 'loading') return;
        clearTimeout(this.loadTimer);
        this.loadedAt = Date.now();
        this.automaticRetries = 0;
        this.update('ready');
      });
      listen('opened', () => { clearTimeout(this.openTimer); });
      listen('closed', () => this.finishPresentation(generation, 'closed'));
      listen('error', () => {
        if (this.status === 'showing') this.finishPresentation(generation, 'failed');
        else this.failLoad(generation);
      });
      ad.load();
    } catch { this.failLoad(generation); }
  };

  /** Resolves once the ad has closed (or could not be shown). Never triggers a load or waits for one. */
  show = (): Promise<InterstitialShowResult> => {
    if (this.status === 'showing') return Promise.resolve('busy');
    if (this.disposed || this.suspended || this.status !== 'ready' || !this.ad) return Promise.resolve('not-ready');
    if (Date.now() - this.loadedAt >= AD_MAX_AGE_MS) {
      void this.preload();
      return Promise.resolve('not-ready');
    }
    const generation = this.generation;
    const ad = this.ad;
    this.update('showing');
    return new Promise<InterstitialShowResult>(resolve => {
      this.presentation = resolve;
      // The player is waiting on this promise: an ad that never opens must not hold them.
      this.openTimer = setTimeout(() => this.finishPresentation(generation, 'failed'), this.openTimeout);
      try { ad.show().catch(() => this.finishPresentation(generation, 'failed')); }
      catch { this.finishPresentation(generation, 'failed'); }
    });
  };

  suspend = (): boolean => {
    if (this.status === 'showing') return false;
    this.suspended = true;
    ++this.generation;
    clearTimeout(this.retryTimer);
    this.releaseAd();
    this.update('unavailable');
    return true;
  };
  resume = () => {
    this.suspended = false;
    this.retryAt = 0;
    return this.preload();
  };
  private finishPresentation(generation: number, result: 'closed' | 'failed') {
    const settle = this.presentation;
    if (generation !== this.generation || !settle) return;
    this.presentation = null;
    ++this.generation;
    this.releaseAd();
    if (result === 'closed') {
      this.update('idle');
      void this.preload();
    } else this.scheduleRetry();
    settle(result);
  }
  private failLoad(generation: number) {
    if (generation !== this.generation || this.disposed) return;
    ++this.generation;
    this.releaseAd();
    this.scheduleRetry();
  }
  private scheduleRetry() {
    this.retryAt = Date.now() + AD_RETRY_DELAY_MS;
    this.update('unavailable');
    // One delayed retry; subsequent retries come from foreground events and new completions.
    clearTimeout(this.retryTimer);
    if (this.automaticRetries++ === 0) {
      this.retryTimer = setTimeout(() => { this.retryAt = 0; void this.preload(); }, AD_RETRY_DELAY_MS);
    }
  }
  private releaseAd() {
    clearTimeout(this.loadTimer);
    clearTimeout(this.openTimer);
    this.listeners.splice(0).forEach(remove => { try { remove(); } catch {} });
    const ad = this.ad;
    this.ad = null;
    try { ad?.destroy(); } catch { /* Best-effort native cleanup. */ }
  }
  dispose = () => {
    this.disposed = true;
    ++this.generation;
    clearTimeout(this.retryTimer);
    const settle = this.presentation;
    this.presentation = null;
    this.releaseAd();
    this.update('unavailable');
    this.subscribers.clear();
    settle?.('failed');
  };
}
