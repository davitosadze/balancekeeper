import { useSettingsStore } from '@/store/settingsStore';
/** OS preference has one root listener; the in-game preference can also reduce motion. */
export function useReducedMotionPreference() {
  return useSettingsStore(state => state.systemReducedMotion || state.settings.reducedMotion === true);
}
