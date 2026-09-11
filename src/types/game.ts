/**
 * Core type definitions for Balance Keeper.
 */

/** The six ball colors used across the game — purely cosmetic, unrelated to weight. */
export type BallColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'cyan';

/** A single ball, identified by a stable id so it can move between the tray and a bottle. */
export interface Ball {
  id: string;
  color: BallColor;
  /** Weight in kg, printed on the ball. */
  weight: number;
}

/** A bottle holding up to TUBE_CAPACITY balls, identified by its index (0-3) on the board. */
export interface Tube {
  index: 0 | 1 | 2 | 3;
  balls: Ball[];
  /** Exact total weight (kg) this bottle must hold to be complete. */
  target: number;
}

/** Static definition of a single puzzle level, loaded from src/data/levels. */
export interface Level {
  id: number;
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  moves: number;
  tubes: Tube[];
  /** The shared pool of balls available to place, in starting order. */
  tray: Ball[];
  hints: string[];
  minMoves: number;
  unlocks: number;
  /** Tube indices that start locked (behind a padlock) until unlockAfterCompletions tubes are completed. */
  lockedTubes?: number[];
  /** How many tube completions unlock this level's lockedTubes. Defaults to 1 when lockedTubes is set. */
  unlockAfterCompletions?: number;
}

/** Record of a single ball placement, used to drive Undo. */
export interface PlacementRecord {
  ball: Ball;
  tubeIndex: number;
}

/** Transient record of a rejected placement attempt, used to drive the shake feedback. */
export interface InvalidPlacementEvent {
  tubeIndex: number;
  at: number;
}

/** A transient floating "+N PTS" popup driven off a scoring event. */
export interface FloatingPointEvent {
  id: string;
  amount: number;
  label: string;
  tubeIndex: number;
}

/** Live mutable game state tracked while a level is being played. */
export interface GameState {
  tubes: Tube[];
  /** Balls not yet placed into a bottle. */
  tray: Ball[];
  score: number;
  level: number;
  moves: number;
  maxMoves: number;
  /** Id of the tray ball currently selected, awaiting a destination tap. */
  selectedBall: string | null;
  gameOver: boolean;
  completedTubes: number[];
  /** History of placements this attempt, in order, for Undo. */
  history: PlacementRecord[];
  /** Transient: set on a placement that overfills a bottle, cleared after the shake plays. */
  invalidPlacement: InvalidPlacementEvent | null;
  /** Active floating point popups, newest last. */
  floatingPoints: FloatingPointEvent[];
}

/** Per-level progress persisted for the player. */
export interface LevelProgress {
  levelId: number;
  bestScore: number;
  stars: 0 | 1 | 2 | 3;
  completed: boolean;
}

/** Aggregate player progress persisted to AsyncStorage. */
export interface PlayerProgress {
  unlockedLevels: number[];
  levelProgress: Record<number, LevelProgress>;
  bestScore: number;
  levelsCompleted: number;
  totalPlaytimeSeconds: number;
  /** Coin currency earned across all levels, shown in the gameplay header. */
  coins: number;
}

/** User-configurable game settings persisted to AsyncStorage. */
export interface GameSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  highContrast: boolean;
  volume: number;
  animationSpeed: 'slow' | 'normal' | 'fast';
}
