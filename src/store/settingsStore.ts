import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { orderedStorage } from '@/domain/persistence';
import { STORAGE_KEY_SETTINGS } from '@/utils/constants';
import type { GameSettings } from '@/types/game';
export const DEFAULT_SETTINGS: GameSettings = { soundEnabled:true, musicEnabled:true, hapticsEnabled:true, highContrast:false, volume:80, animationSpeed:'normal', reducedMotion:false };
const storage = orderedStorage(AsyncStorage);
export const useSettingsStore = create<{
  settings: GameSettings; ready: boolean; error: string | null; systemReducedMotion: boolean;
  update: (patch: Partial<GameSettings>) => Promise<void>; retry: () => Promise<void>;
}>((set,get) => {
  const save = async () => {
    storage.setItem(STORAGE_KEY_SETTINGS,JSON.stringify(get().settings));
    try { await storage.flush(); set({error:null}); } catch { set({error:'Settings could not be saved. Please retry.'}); }
  };
  return { settings:DEFAULT_SETTINGS, ready:false, error:null, systemReducedMotion:false,
    update: async patch => { if(!get().ready)return; set({settings:{...get().settings,...patch}}); await save(); }, retry:save };
});
let loading: Promise<void> | undefined;
export function loadSettings() {
  return loading ??= storage.getItem(STORAGE_KEY_SETTINGS).then(raw => {
    let saved: Partial<GameSettings> = {}; try { saved = raw ? JSON.parse(raw) ?? {} : {}; } catch {}
    useSettingsStore.setState({ready:true,settings:{...DEFAULT_SETTINGS,...saved,
      soundEnabled:saved.soundEnabled !== false,musicEnabled:saved.musicEnabled !== false,hapticsEnabled:saved.hapticsEnabled !== false,
      reducedMotion:saved.reducedMotion === true,volume:typeof saved.volume === 'number' ? Math.max(0,Math.min(100,saved.volume)) : 80 }});
  }).catch(() => { useSettingsStore.setState({error:'Settings could not be loaded. Retry to protect your saved preferences.'}); loading=undefined; });
}
