import type { HapticEvent } from '@/hooks/useHaptics';
import type { SoundEffect } from '@/hooks/useAudio';

/**
 * UI-chrome feedback that isn't driven by a gameplay effect (pause/coins taps
 * and similar). Gameplay sounds (pickup, drop, cracks, level complete/failed,
 * unlock, undo, hint, shuffle) are driven directly off the semantic effect
 * journal in domain/feedback.ts via useGameplayFeedback, not through this map.
 */
export type GameEvent = 'lightTap';

export interface EventFeedback {
  haptic?: HapticEvent;
  sound?: SoundEffect;
}

export const EVENT_MAP: Record<GameEvent, EventFeedback> = {
  lightTap: { haptic: 'select', sound: 'buttonTap' },
};
