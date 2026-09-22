import { Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { MUSIC_ASSETS, type MusicTrack } from '@/assets/music';
import { useSettingsStore } from '@/store/settingsStore';

type Player = ReturnType<typeof createAudioPlayer>;

/** Music sits under SFX so a placement chime always reads clearly over the loop. */
const MUSIC_GAIN = 0.5;
const CROSSFADE_MS = 900;
const STOP_FADE_MS = 350;
const FADE_STEPS = 18;

let players: Partial<Record<MusicTrack,Player>> = {};
let currentTrack: MusicTrack | null = null;
let fadeTimers: Partial<Record<MusicTrack,ReturnType<typeof setInterval>>> = {};

/** Players are created once, on first use, and reused for the rest of the session — never re-instantiated per transition. */
function getPlayer(track: MusicTrack): Player {
  let player = players[track];
  if (!player) {
    player = createAudioPlayer(MUSIC_ASSETS[track], { downloadFirst: false });
    player.loop = true;
    player.volume = 0;
    players[track] = player;
  }
  return player;
}

function clearFade(track: MusicTrack) {
  const active = fadeTimers[track];
  if (active) { clearInterval(active); delete fadeTimers[track]; }
}

function fade(track: MusicTrack, to: number, durationMs: number, onDone?: () => void) {
  clearFade(track);
  const player = players[track];
  if (!player) { onDone?.(); return; }
  const from = player.volume;
  if (Math.abs(from - to) < 0.001) { onDone?.(); return; }
  let step = 0;
  const stepMs = Math.max(16, durationMs / FADE_STEPS);
  fadeTimers[track] = setInterval(() => {
    step++;
    const t = Math.min(1, step / FADE_STEPS);
    try { player.volume = from + (to - from) * t; } catch {}
    if (t >= 1) { clearFade(track); onDone?.(); }
  }, stepMs);
}

function targetVolume(): number {
  const { ready, settings } = useSettingsStore.getState();
  if (!ready || !settings.musicEnabled || settings.volume === 0) return 0;
  return (settings.volume / 100) * MUSIC_GAIN;
}

/** Re-applies the desired track/volume to every cached player: fades the current one in, the rest out.
 *  `forcePlay` re-issues play() even if the player already claims to be playing — needed because expo-audio's
 *  web player marks itself playing optimistically and never un-marks itself when the browser's autoplay
 *  policy silently rejects that first call, so `.playing` can't be trusted to decide whether a retry is due. */
function apply(forcePlay = false) {
  const desired = currentTrack;
  const to = desired ? targetVolume() : 0;
  for (const key of Object.keys(players) as MusicTrack[]) {
    const player = players[key];
    if (!player) continue;
    if (key === desired && to > 0) {
      if (forcePlay || !player.playing) { try { player.play(); } catch {} }
      fade(key, to, CROSSFADE_MS);
    } else {
      const wasCurrent = key === desired;
      fade(key, 0, wasCurrent ? STOP_FADE_MS : CROSSFADE_MS, () => { try { player.pause(); } catch {} });
    }
  }
}

export const musicManager = {
  /** Idempotent while already the current track — screens can call this on every focus without restarting playback. */
  play(track: MusicTrack) {
    if (currentTrack === track) { apply(); return; }
    currentTrack = track;
    getPlayer(track);
    apply();
  },
  stop() { currentTrack = null; apply(); },
  /** Re-applies enabled/volume state to whatever is (or should be) playing, without changing the track. */
  refresh() { apply(); },
  /** Web only: forces a retried play() after the page's first user gesture (see the autoplay-policy listener below). */
  retryAfterGesture() { apply(true); },
  dispose() {
    currentTrack = null;
    (Object.keys(fadeTimers) as MusicTrack[]).forEach(clearFade);
    Object.values(players).forEach(player => { try { player.remove(); } catch {} });
    players = {};
  },
};

useSettingsStore.subscribe((state, prev) => {
  if (state.settings.musicEnabled !== prev.settings.musicEnabled
    || state.settings.volume !== prev.settings.volume
    || state.ready !== prev.ready) musicManager.refresh();
});

// Browser autoplay policy silently blocks the very first play() call until the page has
// seen a user gesture, and expo-audio's web player doesn't surface that rejection to us.
// Retry once the user actually taps anything, so menu music reliably starts on web.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => musicManager.retryAfterGesture(), { once: true, capture: true });
}
