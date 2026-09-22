import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { soundManager } from '@/services/soundManager';
import { loadSettings, useSettingsStore } from '@/store/settingsStore';
import type { SoundEffect } from '@/domain/feedback';
export type { SoundEffect } from '@/domain/feedback';
/** Screen focus owns playback; cached handles survive route transitions. */
export function useAudio() {
  const token=useRef({});
  const enabled=useSettingsStore(state=>state.ready&&state.settings.soundEnabled&&state.settings.volume>0);
  useFocusEffect(useCallback(()=>{
    void loadSettings();const owner=token.current;soundManager.activate(owner);
    return()=>soundManager.deactivate(owner);
  },[enabled]));
  const playSound=useCallback((type:SoundEffect)=>soundManager.play(token.current,type),[]);
  return {playSound};
}
