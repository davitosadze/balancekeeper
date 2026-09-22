import { createAudioPlayer } from 'expo-audio';
import { SOUND_ASSETS } from '@/assets/sounds';
import { SOUND_CUES, chooseSound, type SoundEffect } from '@/domain/feedback';
import { useSettingsStore } from '@/store/settingsStore';

type Player = ReturnType<typeof createAudioPlayer>;
type AssetKey = keyof typeof SOUND_ASSETS;

let players: Partial<Record<AssetKey,Player>> = {};
let owner: object | null = null, version = 0;
let timer: ReturnType<typeof setTimeout> | undefined, pending: SoundEffect | null = null;
let last = {at:0,priority:0};
let layeredLast: Partial<Record<SoundEffect,number>> = {};

/** Cues that run on their own throttle (e.g. ball_bounce) never share a player with the single-voice channel. */
const layeredAssets = new Set(Object.values(SOUND_CUES).filter(cue => cue.layered).map(cue => cue.asset));
const pauseAll = () => Object.values(players).forEach(player => {try {player.pause();}catch{}});
const pauseMainVoices = () => Object.entries(players).forEach(([key,player]) => {
  if(!layeredAssets.has(key as AssetKey)) { try {player.pause();}catch{} }
});

export function prepareSounds() {
  const {ready,settings} = useSettingsStore.getState();
  if(!ready || !settings.soundEnabled || settings.volume === 0)return;
  for(const [key,source] of Object.entries(SOUND_ASSETS)) {
    const id=key as AssetKey;
    if(!players[id]) { try { const player=createAudioPlayer(source,{downloadFirst:true});player.volume=0;players[id]=player; } catch {} }
  }
}

function playLayered(type: SoundEffect, volume: number) {
  const spec = SOUND_CUES[type];
  const now = Date.now();
  if (now - (layeredLast[type] ?? 0) < (spec.minIntervalMs ?? 120)) return;
  const player = players[spec.asset];
  if (!player?.isLoaded) return;
  layeredLast[type] = now;
  try {
    player.volume = volume * spec.gain;
    void player.seekTo(0).then(() => { try { player.play(); } catch {} }).catch(() => {});
  } catch {}
}

export const soundManager = {
  activate(token: object) { owner=token;prepareSounds(); },
  deactivate(token: object) { if(owner!==token)return;owner=null;version++;if(timer)clearTimeout(timer);timer=undefined;pending=null;pauseAll(); },
  play(token: object,type: SoundEffect) {
    const {ready,settings}=useSettingsStore.getState();
    if(owner!==token||!ready||!settings.soundEnabled||settings.volume===0)return;
    const spec = SOUND_CUES[type];
    if(spec.layered) { playLayered(type, settings.volume/100); return; }
    pending=chooseSound(pending,type);if(timer)return;
    timer=setTimeout(() => {
      timer=undefined;const cue=pending;pending=null;
      const current=useSettingsStore.getState().settings;
      if(!cue||owner!==token||!current.soundEnabled)return;
      const now=Date.now(), cueSpec=SOUND_CUES[cue];
      if(now-last.at<180&&cueSpec.priority<=last.priority)return;
      last={at:now,priority:cueSpec.priority};pauseMainVoices();const at=++version;
      const player=players[cueSpec.asset];
      if(!player?.isLoaded)return;
      void player.seekTo(0).then(() => {
        if(owner===token&&at===version&&useSettingsStore.getState().settings.soundEnabled){player.volume=current.volume/100*cueSpec.gain;player.play();}
      }).catch(() => {});
    },24);
  },
  dispose() {version++;owner=null;if(timer)clearTimeout(timer);timer=undefined;pending=null;layeredLast={};Object.values(players).forEach(player=>{try{player.remove();}catch{}});players={};},
};
