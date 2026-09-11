import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_PROGRESS } from '@/utils/constants';
import type { PlayerProgress } from '@/types/game';

/**
 * Persists player progress to AsyncStorage as JSON.
 * @param progress - The progress object to save.
 */
export async function saveProgress(progress: PlayerProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
  } catch (error) {
    console.warn('Failed to save progress', error);
  }
}

/**
 * Loads player progress from AsyncStorage.
 * @returns The saved progress, or null if none is stored or parsing fails.
 */
export async function loadProgress(): Promise<PlayerProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerProgress;
  } catch (error) {
    console.warn('Failed to load progress', error);
    return null;
  }
}

/**
 * Deletes any saved progress from AsyncStorage.
 */
export async function clearProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_PROGRESS);
  } catch (error) {
    console.warn('Failed to clear progress', error);
  }
}

/**
 * Hook wrapper exposing the storage functions with a stable identity.
 */
export function useStorage() {
  return { saveProgress, loadProgress, clearProgress };
}
