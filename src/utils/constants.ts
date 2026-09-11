import type { BallColor } from '@/types/game';

/** Hex colors for each ball color option. */
export const COLORS: Record<BallColor, string> = {
  red: '#e53935',
  blue: '#1688e8',
  green: '#10b981',
  yellow: '#e9a900',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
};

/** Order colors cycle through when a level generates its tray. */
export const BALL_COLOR_CYCLE: BallColor[] = ['blue', 'red', 'yellow', 'green', 'purple', 'cyan'];

/** Smallest and largest ball render sizes (px diameter); weight interpolates between them. */
export const BALL_SIZE_RANGE = { min: 26, max: 42 };

/** The heaviest ball weight (kg) the size scale is calibrated against. */
export const BALL_MAX_WEIGHT = 8;

/**
 * Render diameter (px) for a ball of a given weight — heavier balls render
 * larger, scaled linearly up to BALL_MAX_WEIGHT.
 */
export function getBallSize(weight: number): number {
  const t = Math.min(1, Math.max(0, weight / BALL_MAX_WEIGHT));
  return Math.round(BALL_SIZE_RANGE.min + t * (BALL_SIZE_RANGE.max - BALL_SIZE_RANGE.min));
}

/** Vertical pitch (px) between stacked balls in a tube — matches the largest ball so stacks don't overlap. */
export const BALL_SLOT_PITCH = BALL_SIZE_RANGE.max;

/** Core UI palette shared across screens and components. */
export const UI_COLORS = {
  background: '#0f172a',
  border: '#1e293b',
  selected: '#fbbf24',
  complete: '#10b981',
  text: '#f1f5f9',
};

/** Display font family names, loaded via @expo-google-fonts/space-grotesk in app/_layout.tsx. */
export const FONTS = {
  displayBold: 'SpaceGrotesk_700Bold',
  displaySemiBold: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
};

/** Light/dark gradient shades per ball color, used for the glossy sphere fill. */
export const BALL_GRADIENT_SHADES: Record<BallColor, { light: string; dark: string }> = {
  red: { light: '#ff8a80', dark: '#b71c1c' },
  blue: { light: '#93c5fd', dark: '#1d4ed8' },
  green: { light: '#6ee7b7', dark: '#047857' },
  yellow: { light: '#ffe082', dark: '#c47f00' },
  purple: { light: '#c4b5fd', dark: '#6d28d9' },
  cyan: { light: '#67e8f9', dark: '#0e7490' },
};

/**
 * Bright outdoor scene tokens for the Gameplay board and MainMenu hero —
 * sky gradient, mountain silhouettes, water band, and a soft sun glow.
 * Everything else in the app keeps the dark UI_COLORS family.
 */
export const SKY_THEME = {
  skyGradient: ['#5eb9e4', '#9ed8f1', '#d4ebf0'] as const,
  sunGlow: 'rgba(255, 247, 214, 0.55)',
  mountainFar: '#93b8c9',
  mountainNear: '#6f9aab',
  water: ['#5eb3c9', '#3f8fa8'] as const,
  waterShimmer: 'rgba(255, 255, 255, 0.35)',
};

/** Wood tones for the ball tray recessed into the table. */
export const TRAY_WOOD_TONES = {
  gradient: ['#8d5a30', '#5c3a1e'] as const,
  border: '#3d2513',
};

/** Dark glass gradient used behind header pills (pause, level, moves, hint). */
export const HEADER_PILL_GRADIENT = ['rgba(36, 48, 68, 0.95)', 'rgba(13, 20, 34, 0.95)'] as const;

/** Accent color per level difficulty tier (1 easiest - 5 hardest), used for the level-select grid. */
export const DIFFICULTY_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#10b981',
  2: '#06b6d4',
  3: '#3b82f6',
  4: '#8b5cf6',
  5: '#ef4444',
};

/** Animation timings and easing shared across Reanimated transitions. */
export const ANIMATIONS = {
  tiltDuration: 300,
  pourDuration: 300,
  easing: 'ease' as const,
};

/** Maximum balls a single bottle can hold. */
export const TUBE_CAPACITY = 4;

/** Number of bottles on the board. */
export const TUBE_COUNT = 4;

/** Flat bottle silhouette geometry: a short neck and a tall body with room for a stack of balls. */
export const BOTTLE_GEOMETRY = {
  neckWidth: 26,
  neckHeight: 20,
  bodyWidth: 64,
  bodyHeight: 148,
};

/** Wood tones for the bottle's mounting pedestal and its weight-readout badge. */
export const PEDESTAL_TONES = {
  gradient: ['#a9713f', '#7a4d26'] as const,
  badgeBg: '#0f172a',
  badgeText: '#5eead4',
};

/** AsyncStorage key used to persist player progress. */
export const STORAGE_KEY_PROGRESS = 'balance-keeper-progress';

/** AsyncStorage key used to persist game settings. */
export const STORAGE_KEY_SETTINGS = 'balance-keeper-settings';

/** How long a floating point popup stays on screen before it's dismissed. */
export const FLOATING_POINT_DURATION_MS = 900;

/** How long the particle-ring burst on a bottle completion plays before fading out. */
export const PARTICLE_BURST_DURATION_MS = 700;

/** How many tube completions unlock a level's lockedTubes, when not specified per-level. */
export const DEFAULT_UNLOCK_AFTER_COMPLETIONS = 1;

/** Number of hints a player gets per level, shown as the badge count on the Hint button. */
export const HINTS_PER_LEVEL = 3;
