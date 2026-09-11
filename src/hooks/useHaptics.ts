import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticEvent = 'select' | 'success' | 'error';

/**
 * Triggers device haptic feedback for game events, gated by an enabled flag.
 */
export function useHaptics(initiallyEnabled = true) {
  const [enabled, setEnabled] = useState(initiallyEnabled);

  const triggerHaptic = useCallback(
    (type: HapticEvent) => {
      if (!enabled || Platform.OS === 'web') return;

      switch (type) {
        case 'select':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    },
    [enabled]
  );

  return { triggerHaptic, enabled, setEnabled };
}
