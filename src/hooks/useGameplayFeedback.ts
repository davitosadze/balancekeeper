import { useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { feedbackForEvent, type SoundEffect, type HapticEvent } from '@/domain/feedback';
import type { GameplayEffect } from '@/types/game';

/** Consume each semantic event once. Re-renders, focus changes and saves cannot replay cues. */
export function useGameplayFeedback(events: GameplayEffect[], playSound: (sound: SoundEffect) => void, triggerHaptic: (haptic: HapticEvent) => void, enabled: boolean) {
  const seen = useRef({ attempt: useGameStore.getState().attemptId, sequence: useGameStore.getState().effectSequence });
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const focused = useRef(false);
  const callbacks = useRef({ playSound, triggerHaptic, enabled });
  callbacks.current = { playSound, triggerHaptic, enabled };
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const state = useGameStore.getState();
    seen.current = { attempt: state.attemptId, sequence: state.effectSequence };
    return () => { focused.current = false; timers.current.forEach(clearTimeout); timers.current.clear(); };
  }, []));
  useEffect(() => {
    const attempt = useGameStore.getState().attemptId;
    if (seen.current.attempt !== attempt) { seen.current = { attempt, sequence: 0 }; timers.current.forEach(clearTimeout); timers.current.clear(); }
    const fresh = events.filter(event => event.sequence > seen.current.sequence);
    // The winning move can also complete its bottle (and extend a combo) in the same
    // batch as LEVEL_COMPLETED; let the level-complete fanfare be the only sound for it.
    const hasLevelCompleted = fresh.some(event => event.type === 'LEVEL_COMPLETED');
    for (const event of fresh) {
      seen.current.sequence = event.sequence;
      if (!enabled || !focused.current) continue;
      const feedback = feedbackForEvent(event);
      const suppressSound = hasLevelCompleted && event.type !== 'LEVEL_COMPLETED';
      const deliver = () => {
        if(!focused.current || !callbacks.current.enabled) return;
        if(feedback.sound && !suppressSound) callbacks.current.playSound(feedback.sound);
        if(feedback.layeredSound && !suppressSound) callbacks.current.playSound(feedback.layeredSound);
        if(feedback.haptic) callbacks.current.triggerHaptic(feedback.haptic);
      };
      // Let the final fit chime finish before the level fanfare; unlock follows fit;
      // the failure fanfare waits out the bottle-shatter animation (EFFECT_TIMING.break).
      const delay = event.type === 'LEVEL_COMPLETED' ? 500 : event.type === 'LEVEL_FAILED' ? 650 : event.type === 'BOTTLE_UNLOCKED' ? 230 : 0;
      // Even a 0ms delay is scheduled via a real timer so audio/haptics never run inside the
      // same synchronous commit as the drop's own re-render and Reanimated effect scheduling.
      const timer = setTimeout(() => { timers.current.delete(timer); deliver(); }, delay);
      timers.current.add(timer);
    }
  }, [events, enabled]);
}
