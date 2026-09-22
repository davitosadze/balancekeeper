import { beginDropMeasure, endDropMeasure } from '@/utils/performance';
import { purchaseCosmetic, equipCosmetic } from '@/domain/cosmetics/inventory';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, PlayerProgress, TransactionReason } from '@/types/game';
import { initialGame, transition, type GameAction } from '@/domain/gameplay';
import { getLevelById, getUnlockedLevels, LEVELS } from '@/data/levels';
import { migrateProgressStorage, restoreProgress, INITIAL_PROGRESS } from '@/domain/progress';
import { addCoins, commitReward, GAME_ECONOMY, rewardTransactionId, spendCoins } from '@/domain/economy';
import { deferredJSONStorage, orderedStorage, persistAttempt, restoreAttempt } from '@/domain/persistence';
import { STORAGE_KEY_PROGRESS } from '@/utils/constants';

export interface ActionResult { accepted: boolean; message?: string }
interface GameStore extends GameState {
  progress: PlayerProgress;
  hydrated: boolean;
  utilityBusy: boolean;
  cosmeticBusy: boolean;
  purchaseCosmetic: (id: string) => Promise<ActionResult>;
  equipCosmetic: (id: string) => Promise<ActionResult>;
  rewardCommitStatus: 'idle' | 'saving' | 'saved' | 'error';
  storageError: string | null;
  finishHydration: () => void;
  dispatch: (action: GameAction) => ActionResult;
  selectBall: (ballId: string) => void;
  placeBall: (tubeIndex: number, impactVelocity?: number) => boolean;
  undoLastPlacement: () => ActionResult;
  requestHint: () => ActionResult;
  shuffleTray: () => ActionResult;
  revive: () => ActionResult;
  reviveWithEarnedReward: (attemptId: string) => ActionResult;
  invalidDrop: () => void;
  resetGame: () => boolean;
  loadLevel: (levelId: number) => boolean;
  commitLevelReward: (attemptId: string) => Promise<ActionResult>;
  finishResult: (attemptId: string, destination: 'continue' | 'replay' | 'levels') => boolean;
  flushPersistence: () => Promise<void>;
  retrySave: () => Promise<void>;
  debugAddCoins?: (amount?: number) => ActionResult;
  clearInvalidPlacement: () => void;
  dismissFloatingPoint: (id: string) => void;
  clearImpact: () => void;
  clearBreak: () => void;
}
let idSequence = 0;
const newAttemptId = () => `${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
const utilityTypes = new Set(['hint', 'undo', 'shuffle', 'revive']);

/** One production store; factory also permits fresh-instance persistence tests. */
export function createGameStore() {
  const ordered = orderedStorage({ ...AsyncStorage, getItem: async name => migrateProgressStorage(await AsyncStorage.getItem(name)) });
  type Saved = { progress: PlayerProgress; sessionVersion: number; attempt: GameState };
  const storage = deferredJSONStorage<Saved>(ordered);
  const volatile = new Set(['selectedBall','hintMove','currentEvent','invalidPlacement','floatingPoints','lastImpact','lastBreak','effects','effectSequence']);
  const keys = (Object.keys(initialGame(getLevelById(1))) as (keyof GameState)[]).filter(key => !volatile.has(key));
  let cached: Saved | undefined;
  let lastRuntime: GameState | undefined;
  const partialize = (state: GameStore): Saved => {
    const changed = !lastRuntime || keys.some(key => lastRuntime![key] !== state[key]);
    if (!cached || changed || cached.progress !== state.progress) {
      cached = { progress: state.progress, sessionVersion: 2,
        attempt: changed || !cached ? persistAttempt(state, getLevelById(state.level)) : cached.attempt };
    }
    lastRuntime = state;
    return cached;
  };
  let lastEventAt = 0;
  let blockedUntil = 0;
  const useStore = create<GameStore>()(persist((set, get) => {
    const freshAttempt = (id: number) => initialGame(getLevelById(id), newAttemptId(), !!get().progress.levelProgress[id]?.completed);
    const hasUncommittedWin = () => get().status === 'won' && get().rewardCommitStatus !== 'saved';
    const changeCosmetic = async (id: string, purchase: boolean): Promise<ActionResult> => {
      const before = get();
      if(!before.hydrated || before.cosmeticBusy || before.utilityBusy || before.rewardCommitStatus === 'saving') return {accepted:false,message:'Please wait for your save.'};
      if(before.storageError) return {accepted:false,message:before.storageError};
      const result = purchase ? purchaseCosmetic(before.progress,id,Date.now()) : equipCosmetic(before.progress,id);
      if(!result.applied) return {accepted:false,message:result.message};
      // Synchronous admission and one profile update precede any async work.
      set({progress:result.progress,cosmeticBusy:true});
      try { await storage.flush(); return {accepted:true}; }
      catch { const message = 'Could not save your cosmetics. Retry save to keep this change.'; set({storageError:message}); return {accepted:false,message}; }
      finally { set({cosmeticBusy:false}); }
    };
    return {
      ...initialGame(getLevelById(1), newAttemptId()), progress: INITIAL_PROGRESS, hydrated: false,
      cosmeticBusy: false,
      purchaseCosmetic: id => changeCosmetic(id,true),
      equipCosmetic: id => changeCosmetic(id,false),
      utilityBusy: false, rewardCommitStatus: 'idle', storageError: null,
      finishHydration: () => set({ hydrated: true }),
      flushPersistence: storage.flush,
      retrySave: async () => {
        // Keep input blocked until the retried write has actually succeeded.
        storage.retry(STORAGE_KEY_PROGRESS, { state: partialize(get()), version: 0 });
        try { await storage.flush(); set({ storageError: null }); }
        catch { set({ storageError: 'Could not save. Please retry.' }); }
      },
      dispatch: action => {
        const before = get();
        if (!before.hydrated) return { accepted: false, message: 'Loading saved progress…' };
        if (before.cosmeticBusy) return {accepted:false,message:'Saving your cosmetics…'};
        if (before.storageError) return { accepted: false, message: before.storageError };
        const utility = utilityTypes.has(action.type);
        if (utility && (before.utilityBusy || Date.now() < blockedUntil)) return { accepted: false };
        const level = getLevelById(before.level);
        lastEventAt = Math.max(Date.now(), lastEventAt + 1);
        const measure = action.type === 'drop' ? beginDropMeasure() : null;
        const result = transition(before, level, action, lastEventAt, before.progress.coins);
        let progress = before.progress;
        if (result.accepted && result.cost > 0) {
          const transaction = spendCoins(progress, result.cost, action.type as TransactionReason,
            `${before.attemptId}:${action.type}:${lastEventAt}`, lastEventAt);
          if (!transaction.applied) return { accepted: false, message: transaction.message };
          progress = transaction.progress;
        }
        if (result.state !== before) {
          if (utility && result.accepted) blockedUntil = Date.now() + GAME_ECONOMY.rapidTapGuardMs;
          // Wallet, free allowances and runtime change in one persisted object.
          set({ ...result.state, progress, utilityBusy: utility && result.accepted ? true : before.utilityBusy });
          if (utility && result.accepted) {
            void storage.flush().catch(() => set({ storageError: 'Could not save. Please retry.' })).finally(() => {
              setTimeout(() => set({ utilityBusy: false }), Math.max(0, blockedUntil - Date.now()));
            });
          }
        }
        endDropMeasure(measure);
        return { accepted: result.accepted, message: result.message };
      },
      selectBall: ballId => { get().dispatch({ type: 'select', ballId }); },
      placeBall: tubeIndex => get().dispatch({ type: 'drop', tubeIndex }).accepted,
      undoLastPlacement: () => get().dispatch({ type: 'undo' }),
      requestHint: () => get().dispatch({ type: 'hint' }),
      shuffleTray: () => get().dispatch({ type: 'shuffle' }),
      revive: () => get().dispatch({ type: 'revive' }),
      reviveWithEarnedReward: attemptId => get().dispatch({ type: 'revive', earnedRewardForAttempt: attemptId }),
      invalidDrop: () => { get().dispatch({ type: 'invalidDrop' }); },
      resetGame: () => {
        if (!get().hydrated || get().utilityBusy || get().cosmeticBusy || hasUncommittedWin()) return false;
        set({ ...freshAttempt(get().level), rewardCommitStatus: 'idle' }); return true;
      },
      loadLevel: id => {
        if (!get().hydrated || get().utilityBusy || get().cosmeticBusy || hasUncommittedWin()
          || !getUnlockedLevels(get().progress.unlockedLevels, get().progress.highestUnlockedLevel).includes(id)) return false;
        set({ ...freshAttempt(id), rewardCommitStatus: 'idle' }); return true;
      },
      commitLevelReward: async attemptId => {
        const before = get(), pending = before.pendingLevelReward;
        if (!before.hydrated || before.status !== 'won' || !pending || before.attemptId !== attemptId || pending.attemptId !== attemptId) return { accepted: false };
        if (before.cosmeticBusy) return {accepted:false,message:'Saving your cosmetics…'};
        if (before.rewardCommitStatus === 'saving') return { accepted: false };
        if (before.rewardCommitStatus === 'saved') return { accepted: true };
        const result = commitReward(before.progress, pending, Date.now());
        if (!result.transaction) return { accepted: false, message: result.message };
        set({ progress: result.progress, rewardCommitStatus: 'saving', storageError: null });
        if(before.rewardCommitStatus === 'error') storage.retry(STORAGE_KEY_PROGRESS, {state:partialize(get()),version:0});
        try {
          await storage.flush();
          if (get().attemptId === attemptId) set({ rewardCommitStatus: 'saved' });
          return { accepted: true };
        } catch {
          if (get().attemptId === attemptId) set({ rewardCommitStatus: 'error', storageError: 'Could not save your reward. Please retry.' });
          return { accepted: false, message: 'Could not save your reward. Please retry.' };
        }
      },
      finishResult: (attemptId, destination) => {
        const state = get();
        if (state.attemptId !== attemptId || state.status !== 'won' || state.rewardCommitStatus !== 'saved') return false;
        const nextId = destination === 'continue' ? LEVELS.find(level => level.id > state.level)?.id ?? state.level : state.level;
        set({ ...freshAttempt(nextId), rewardCommitStatus: 'idle' });
        return true;
      },
      ...(typeof __DEV__ !== 'undefined' && __DEV__ ? {
        debugAddCoins: (amount = 500): ActionResult => {
          if (!get().hydrated || get().cosmeticBusy || get().storageError || !Number.isSafeInteger(amount) || amount < 1 || amount > 10000) return { accepted: false };
          const result = addCoins(get().progress, amount, 'debug', `debug:${newAttemptId()}`, Date.now());
          if (result.applied) set({ progress: result.progress });
          return { accepted: result.applied };
        },
      } : {}),
      clearInvalidPlacement: () => set({ invalidPlacement: null }),
      dismissFloatingPoint: id => set(state => ({ floatingPoints: state.floatingPoints.filter(point => point.id !== id) })),
      clearImpact: () => set({ lastImpact: null }),
      clearBreak: () => set({ lastBreak: null }),
    };
  }, {
    name: STORAGE_KEY_PROGRESS,
    storage,
    onRehydrateStorage: () => (state, error) => {
      if (state && !error) state.finishHydration();
    },
    partialize,
    merge: (persisted, current) => {
      const saved = persisted as { progress?: Partial<PlayerProgress>; sessionVersion?: number; attempt?: GameState } | undefined;
      const progress = restoreProgress(saved?.progress);
      const level = LEVELS.find(level => level.id === saved?.attempt?.level);
      const attempt = saved?.sessionVersion === 2 && level ? restoreAttempt(saved.attempt, level) : null;
      return { ...current, progress, ...(attempt ?? initialGame(level ?? getLevelById(1), current.attemptId, !!progress.levelProgress[level?.id ?? 1]?.completed)),
        rewardCommitStatus: attempt?.status === 'won' && progress.transactions[rewardTransactionId(attempt.attemptId)] ? 'saved' : 'idle' };
    },
  }));
  storage.onError(() => useStore.setState({ storageError: 'Could not save. Please retry.' }));
  return useStore;
}
export const useGameStore = createGameStore();
