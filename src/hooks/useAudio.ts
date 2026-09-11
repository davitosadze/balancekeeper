import { useCallback, useState } from 'react';

export type SoundEffect = 'pour' | 'complete' | 'levelup' | 'error';

/**
 * Loads and plays short sound effects for game events, with a mute toggle.
 * No sound assets are bundled yet, so this is currently a no-op stub — it
 * keeps the same interface callers already use so wiring in real playback
 * later (e.g. via expo-audio, once assets exist) doesn't touch call sites.
 * Previously used expo-av, but Expo Go no longer ships that native module.
 */
export function useAudio() {
  const [muted, setMuted] = useState(false);

  const playSound = useCallback(async (_type: SoundEffect) => {
    // No bundled sound assets yet — nothing to play.
  }, []);

  const toggleMute = useCallback(() => setMuted((prev) => !prev), []);

  return { playSound, muted, toggleMute };
}
