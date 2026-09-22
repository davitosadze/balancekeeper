/** Looping background tracks in assets/audio/music. */
export const MUSIC_ASSETS = {
  menu: require('../../assets/audio/music/menu.wav'),
  gameplay: require('../../assets/audio/music/gameplay.wav'),
  gameplayHard: require('../../assets/audio/music/gameplay-hard.wav'),
};
export type MusicTrack = keyof typeof MUSIC_ASSETS;
