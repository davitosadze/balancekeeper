import type { HapticEvent } from '@/hooks/useHaptics';
import type { SoundEffect } from '@/hooks/useAudio';

/**
 * Game event -> feedback mapping. Every place in the UI that triggers one of
 * these events should look it up here rather than hardcoding a haptic/sound
 * pair, so the whole feel of the game can be tuned from one file.
 */
export type GameEvent =
  | 'lightTap' // selecting a tray ball
  | 'ballPlaced' // a ball lands in a bottle
  | 'invalidPlacement' // a placement was rejected (would overfill the bottle)
  | 'bottleComplete' // a bottle was filled to exactly its target weight
  | 'levelComplete' // the level was won
  | 'levelFailed' // the level ran out of moves or the tray emptied unsolved
  | 'undo'; // the last placement was undone

export interface EventFeedback {
  haptic?: HapticEvent;
  sound?: SoundEffect;
}

export const EVENT_MAP: Record<GameEvent, EventFeedback> = {
  lightTap: { haptic: 'select' },
  ballPlaced: { haptic: 'select', sound: 'pour' },
  invalidPlacement: { haptic: 'error', sound: 'error' },
  bottleComplete: { haptic: 'success', sound: 'complete' },
  levelComplete: { haptic: 'success', sound: 'levelup' },
  levelFailed: { haptic: 'error', sound: 'error' },
  undo: { haptic: 'select' },
};
