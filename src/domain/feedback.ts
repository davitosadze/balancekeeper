import type { GameplayEffect } from '../types/game';
import { SOUND_ASSETS } from '../assets/sounds';

export type HapticEvent = 'select' | 'success' | 'error' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'warning';

type AssetKey = keyof typeof SOUND_ASSETS;
/** The 19 real clips play under their own name; these few gameplay/assist events
 *  have no dedicated file yet and reuse the closest existing one until Foley lands. */
export type SoundEffect = AssetKey | 'combo' | 'hint' | 'shuffle' | 'undo' | 'revive' | 'star';

interface SoundCue {
  asset: AssetKey; priority: number; gain: number;
  /** Layered cues (e.g. a physical bounce) play on their own throttle, independent of the single-voice channel. */
  layered?: boolean; minIntervalMs?: number;
}

export const SOUND_CUES: Record<SoundEffect, SoundCue> = {
  ballPickup: { asset: 'ballPickup', priority: 1, gain: .55 },
  ballDrop: { asset: 'ballDrop', priority: 2, gain: .7 },
  ballBounce: { asset: 'ballBounce', priority: 1, gain: .3, layered: true, minIntervalMs: 140 },
  correct: { asset: 'correct', priority: 7, gain: .75 },
  invalidDrop: { asset: 'invalidDrop', priority: 3, gain: .55 },
  bottleCrack1: { asset: 'bottleCrack1', priority: 6, gain: .7 },
  bottleCrack2: { asset: 'bottleCrack2', priority: 6, gain: .78 },
  bottleBreak: { asset: 'bottleBreak', priority: 10, gain: .85 },
  warning: { asset: 'warning', priority: 5, gain: .6 },
  levelComplete: { asset: 'levelComplete', priority: 9, gain: .8 },
  levelFailed: { asset: 'levelFailed', priority: 9, gain: .8 },
  buttonTap: { asset: 'buttonTap', priority: 1, gain: .5 },
  back: { asset: 'back', priority: 1, gain: .5 },
  shopOpen: { asset: 'shopOpen', priority: 4, gain: .7 },
  itemSelect: { asset: 'itemSelect', priority: 2, gain: .6 },
  purchase: { asset: 'purchase', priority: 8, gain: .8 },
  purchaseFailed: { asset: 'purchaseFailed', priority: 4, gain: .6 },
  coin: { asset: 'coin', priority: 4, gain: .65 },
  unlock: { asset: 'unlock', priority: 8, gain: .75 },
  // No dedicated asset provided for these; reuse the closest existing clip. 'coin' is kept
  // exclusively for the real coin-award moment, so it never gets diluted by repeats here.
  combo: { asset: 'itemSelect', priority: 4, gain: .5 },
  hint: { asset: 'itemSelect', priority: 3, gain: .5 },
  shuffle: { asset: 'itemSelect', priority: 3, gain: .5 },
  undo: { asset: 'back', priority: 3, gain: .55 },
  revive: { asset: 'unlock', priority: 6, gain: .6 },
  star: { asset: 'itemSelect', priority: 4, gain: .55 },
};
export function chooseSound(a: SoundEffect | null, b: SoundEffect): SoundEffect {
  return !a || SOUND_CUES[b].priority > SOUND_CUES[a].priority ? b : a;
}
export const HAPTIC_PRIORITY: Record<HapticEvent,number> = { select:1, impactLight:2, impactMedium:3, success:4, warning:5, impactHeavy:6, error:7 };

export interface EventFeedback {
  sound?: SoundEffect;
  /** An independently-throttled sound that plays alongside `sound` rather than competing with it. */
  layeredSound?: SoundEffect;
  haptic?: HapticEvent;
}

export function feedbackForEvent(event: GameplayEffect): EventFeedback {
  switch(event.type) {
    case 'BALL_PICKUP': return {sound:'ballPickup',haptic:'select'};
    case 'DROP_SUCCESS': return {sound:'ballDrop',layeredSound:'ballBounce',haptic:'impactLight'};
    case 'DROP_INVALID': return event.reason === 'overload' ? {} : {sound:'invalidDrop',haptic:'select'};
    case 'PERFECT_FIT': return {sound:'correct',haptic:'success'};
    case 'COMBO_CHANGED': return (event.tier ?? 0) >= 2 ? {sound:'combo'} : {};
    // damage is the bottle's cumulative mistake count after this hit: 1 = first crack, 2+ = later cracks.
    case 'BOTTLE_CRACKED': return {sound:(event.damage ?? 1) >= 2 ? 'bottleCrack2' : 'bottleCrack1',haptic:'warning'};
    case 'BOTTLE_BROKEN': return {sound:'bottleBreak',haptic:'error'};
    case 'BOTTLE_UNLOCKED': return {sound:'unlock',haptic:'impactLight'};
    case 'BOTTLE_STRESS_CHANGED': return event.stress === 'danger' ? {sound:'warning',haptic:'warning'} : {};
    // The sound itself plays on the Level Complete screen once it's actually on screen, not here.
    case 'LEVEL_COMPLETED': return {haptic:'success'};
    case 'LEVEL_FAILED': return {sound:'levelFailed',haptic:'error'};
    case 'UNDO': return {sound:'undo',haptic:'select'};
    case 'REVIVE': return {sound:'revive',haptic:'select'};
    case 'HINT': return {sound:'hint',haptic:'select'};
    case 'SHUFFLE': return {sound:'shuffle',haptic:'select'};
    default: return {};
  }
}
