import { useGameStore } from '@/store/gameStore';

/** Compatibility facade: the Zustand store is the only progress writer. */
export async function loadProgress() {
  if (!useGameStore.persist.hasHydrated()) await useGameStore.persist.rehydrate();
  return useGameStore.getState().progress;
}
export function useStorage() {
  return { loadProgress, flushProgress: useGameStore.getState().flushPersistence };
}
