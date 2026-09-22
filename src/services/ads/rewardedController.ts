import { AD_LOAD_TIMEOUT_MS, AD_MAX_AGE_MS, AD_RETRY_DELAY_MS } from './config';

export type AdStatus = 'idle' | 'loading' | 'ready' | 'showing' | 'unavailable';
export type AdEvent = 'loaded' | 'opened' | 'earned' | 'closed' | 'error';
export interface RewardedHandle {
  listen: (event: AdEvent, listener: () => void) => () => void;
  load: () => void;
  show: () => Promise<unknown>;
  destroy: () => void;
}
export interface RewardedAdapter {
  initialize: () => Promise<boolean>;
  create: () => RewardedHandle;
}
export interface RewardRequest {
  owner: object;
  isValid: () => boolean;
  onEarned: () => void;
  onDismissed?: (earned: boolean) => void;
  onError?: () => void;
}
export type ShowResult = { shown: true } | { shown: false; reason: 'not-ready' | 'busy' | 'stale' | 'failed' };

/** App-scoped inventory; each consumption owns its callbacks and native listeners. */
export class RewardedController {
  private status: AdStatus = 'idle';
  private subscribers = new Set<() => void>();
  private ad: RewardedHandle | null = null;
  private listeners: (() => void)[] = [];
  private loadTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private request: (RewardRequest & { earned: boolean }) | null = null;
  private generation = 0;
  private loadedAt = 0;
  private retryAt = 0;
  private automaticRetries = 0;
  private disposed = false;
  private suspended = false;

  constructor(private adapter: RewardedAdapter, private loadTimeout = AD_LOAD_TIMEOUT_MS) {}
  getSnapshot = (): AdStatus => this.status;
  subscribe = (listener: () => void) => {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  };
  private update(status: AdStatus) {
    this.status = status;
    this.subscribers.forEach(listener => listener());
  }
  initialize = () => this.preload();

  preload = async (): Promise<void> => {
    if (this.disposed || this.suspended || this.status === 'showing' || this.status === 'loading') return;
    if (this.status === 'ready' && Date.now() - this.loadedAt < AD_MAX_AGE_MS) return;
    if (Date.now() < this.retryAt) return;
    this.releaseAd();
    const generation = ++this.generation;
    this.update('loading');
    this.loadTimer = setTimeout(() => this.fail(generation), this.loadTimeout);
    try {
      if (!await this.adapter.initialize()) {
        this.fail(generation);
        return;
      }
      if (generation !== this.generation || this.disposed || this.suspended) return;
      const ad = this.adapter.create();
      this.ad = ad;
      const listen = (event: AdEvent, callback: () => void) => {
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
      listen('opened', () => { /* Opening an ad is never a reward. */ });
      listen('earned', () => {
        const request = this.request;
        if (this.status !== 'showing' || !request || request.earned) return;
        // Consume before invoking user code so repeated SDK events cannot pay twice.
        request.earned = true;
        try { if (request.isValid()) request.onEarned(); } catch { /* Gameplay must survive callback errors. */ }
      });
      listen('closed', () => {
        const request = this.request;
        this.request = null;
        this.releaseAd();
        ++this.generation;
        this.update('idle');
        try { if (request?.isValid()) request.onDismissed?.(request.earned); } catch { /* Isolate callers. */ }
        void this.preload();
      });
      listen('error', () => this.fail(generation));
      ad.load();
    } catch { this.fail(generation); }
  };

  show = async (request: RewardRequest): Promise<ShowResult> => {
    if (this.status === 'showing') return { shown: false, reason: 'busy' };
    if (this.disposed || this.suspended || this.status !== 'ready' || !this.ad) return { shown: false, reason: 'not-ready' };
    if (Date.now() - this.loadedAt >= AD_MAX_AGE_MS) {
      void this.preload();
      return { shown: false, reason: 'not-ready' };
    }
    try { if (!request.isValid()) return { shown: false, reason: 'stale' }; }
    catch { return { shown: false, reason: 'stale' }; }
    const generation = this.generation;
    const ad = this.ad;
    this.request = { ...request, earned: false };
    this.update('showing');
    try {
      await ad.show();
      return { shown: true };
    } catch {
      this.fail(generation);
      return { shown: false, reason: 'failed' };
    }
  };

  cancel = (owner: object) => {
    if (this.request?.owner === owner) this.request = null;
    // Keep the global showing lock until the native close/error event arrives.
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
  private fail(generation: number) {
    if (generation !== this.generation || this.disposed) return;
    ++this.generation;
    const request = this.request;
    this.request = null;
    this.releaseAd();
    this.retryAt = Date.now() + AD_RETRY_DELAY_MS;
    this.update('unavailable');
    try { if (request?.isValid()) request.onError?.(); } catch { /* Isolate callers. */ }
    // One delayed retry; subsequent retries come from foreground/focus events.
    clearTimeout(this.retryTimer);
    if (this.automaticRetries++ === 0) {
      this.retryTimer = setTimeout(() => { this.retryAt = 0; void this.preload(); }, AD_RETRY_DELAY_MS);
    }
  }
  private releaseAd() {
    clearTimeout(this.loadTimer);
    this.listeners.splice(0).forEach(remove => { try { remove(); } catch {} });
    const ad = this.ad;
    this.ad = null;
    try { ad?.destroy(); } catch { /* Best-effort native cleanup. */ }
  }
  dispose = () => {
    this.disposed = true;
    ++this.generation;
    clearTimeout(this.retryTimer);
    this.request = null;
    this.releaseAd();
    this.update('unavailable');
    this.subscribers.clear();
  };
}
