import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export type SoundEffect = 'pour' | 'complete' | 'levelup' | 'error';

const SOUND_SOURCES: Record<SoundEffect, number | null> = {
  pour: null,
  complete: null,
  levelup: null,
  error: null,
};

/**
 * Loads and plays short sound effects for game events, with a mute toggle.
 * Sound assets are optional: if a source isn't bundled, playback is a no-op
 * rather than throwing, so the game runs fine without audio assets present.
 */
export function useAudio() {
  const [muted, setMuted] = useState(false);
  const soundsRef = useRef<Partial<Record<SoundEffect, Audio.Sound>>>({});

  const playSound = useCallback(
    async (type: SoundEffect) => {
      if (muted) return;
      const source = SOUND_SOURCES[type];
      if (!source) return;

      try {
        let sound = soundsRef.current[type];
        if (!sound) {
          const { sound: loaded } = await Audio.Sound.createAsync(source);
          sound = loaded;
          soundsRef.current[type] = loaded;
        }
        await sound.replayAsync();
      } catch (error) {
        console.warn(`Failed to play sound: ${type}`, error);
      }
    },
    [muted]
  );

  const toggleMute = useCallback(() => setMuted((prev) => !prev), []);

  return { playSound, muted, toggleMute };
}
