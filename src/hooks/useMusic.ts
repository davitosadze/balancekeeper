import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { musicManager } from '@/services/musicManager';
import type { MusicTrack } from '@/assets/music';

/** Requests a looping background track whenever this screen is focused. Calling this with the
 *  same track the manager is already playing is a no-op — it never restarts the loop. */
export function useMusic(track: MusicTrack) {
  useFocusEffect(useCallback(() => { musicManager.play(track); }, [track]));
}
