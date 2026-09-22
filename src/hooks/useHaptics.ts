import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { loadSettings, useSettingsStore } from '@/store/settingsStore';
import * as Haptics from 'expo-haptics';
import { HAPTIC_PRIORITY, type HapticEvent } from '@/domain/feedback';
export type { HapticEvent } from '@/domain/feedback';

/** Focus-aware, saved-setting-aware device feedback; web and unavailable hardware are no-ops. */
export function useHaptics(initiallyEnabled = true) {
  const [localEnabled, setEnabled] = useState(initiallyEnabled);
  const enabled = useSettingsStore(state => state.ready && state.settings.hapticsEnabled) && localEnabled;
  const focused = useRef(false), pending = useRef<HapticEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFocusEffect(useCallback(() => {
    focused.current = true; void loadSettings();
    return () => { focused.current = false; if(timer.current) clearTimeout(timer.current); timer.current = null; pending.current = null; };
  }, []));
  const triggerHaptic = useCallback((type: HapticEvent) => {
    if (!enabled || !focused.current || !['ios','android'].includes(Platform.OS)) return;
    if (!pending.current || HAPTIC_PRIORITY[type] > HAPTIC_PRIORITY[pending.current]) pending.current = type;
    if(timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null; const cue = pending.current; pending.current = null;
      if(!cue || !focused.current || !useSettingsStore.getState().settings.hapticsEnabled) return;
      try {
        const promise = cue === 'select' ? Haptics.selectionAsync()
          : cue === 'success' || cue === 'warning' || cue === 'error'
            ? Haptics.notificationAsync(cue === 'success' ? Haptics.NotificationFeedbackType.Success : cue === 'warning' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error)
            : Haptics.impactAsync(cue === 'impactHeavy' ? Haptics.ImpactFeedbackStyle.Heavy : cue === 'impactMedium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        void promise.catch(() => {});
      } catch { /* Device feedback must never interrupt gameplay. */ }
    }, 24);
  }, [enabled]);
  return { triggerHaptic, enabled, setEnabled };
}
