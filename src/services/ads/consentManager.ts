export interface ConsentInfo { canRequestAds: boolean; privacyOptionsRequirementStatus: string }
export interface ConsentSDK {
  requestInfoUpdate: () => Promise<ConsentInfo>;
  loadAndShowConsentFormIfRequired: () => Promise<ConsentInfo>;
  getConsentInfo: () => Promise<ConsentInfo>;
  showPrivacyOptionsForm: () => Promise<ConsentInfo>;
  initializeAds: () => Promise<unknown>;
}
interface PrivacyState { required: boolean; busy: boolean; error: string | null }

function bounded<T>(operation: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Consent service timed out')), ms);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** UMP owns permission decisions. No consent string or inferred permission is persisted here. */
export class ConsentManager {
  private startup?: Promise<void>;
  private adsInitialization?: Promise<unknown>;
  private state: PrivacyState = { required: false, busy: false, error: null };
  private subscribers = new Set<() => void>();
  constructor(private sdk: ConsentSDK, private timeout = 10_000) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  };
  private update(patch: Partial<PrivacyState>) {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach(listener => listener());
  }
  private record(info: ConsentInfo) {
    this.update({ required: info.privacyOptionsRequirementStatus === 'REQUIRED' });
    return info.canRequestAds;
  }
  private async gather() {
    this.update({ busy: true });
    try {
      this.record(await bounded(this.sdk.requestInfoUpdate(), this.timeout));
      // A user reading a consent form has no deadline; gameplay is never gated on this promise.
      this.record(await this.sdk.loadAndShowConsentFormIfRequired());
    } catch { /* UMP may still permit requests using consent from a previous session. */ }
    finally { this.update({ busy: false }); }
  }
  initialize = async (): Promise<boolean> => {
    this.startup ??= this.gather();
    await this.startup;
    if (this.state.busy) return false;
    try {
      if (!this.record(await bounded(this.sdk.getConsentInfo(), this.timeout))) return false;
      this.adsInitialization ??= this.sdk.initializeAds();
      await bounded(this.adsInitialization, this.timeout);
      return true;
    } catch { return false; }
  };
  showPrivacyOptions = async (): Promise<boolean> => {
    if (this.state.busy || !this.state.required) return false;
    this.update({ busy: true, error: null });
    try {
      this.record(await this.sdk.showPrivacyOptionsForm());
      return true;
    } catch {
      this.update({ error: 'Privacy options could not open. Please try again.' });
      return false;
    } finally { this.update({ busy: false }); }
  };
}
