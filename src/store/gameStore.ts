import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, Tube, PlayerProgress, FloatingPointEvent } from '@/types/game';
import { canPlaceBall, isBottleComplete, isTubeLocked, type LockState } from '@/utils/physics';
import {
  calculatePlacementPoints,
  calculateBottleCompleteBonus,
  calculateLevelBonus,
  calculateMoveBonus,
  calculateStars,
} from '@/utils/scoring';
import { getLevelById } from '@/data/levels';
import { STORAGE_KEY_PROGRESS } from '@/utils/constants';

let floatingPointSeq = 0;
function nextFloatingPointId(): string {
  floatingPointSeq += 1;
  return `fp-${floatingPointSeq}`;
}

const FIRST_LEVEL_ID = 1;
/** The hand-built gimmick-showcase level (locked bottle) is always unlocked, not gated behind finishing all core levels. */
const BONUS_LEVEL_ID = 51;

function cloneTubes(tubes: Tube[]): Tube[] {
  return tubes.map((tube) => ({ index: tube.index, target: tube.target, balls: tube.balls.map((b) => ({ ...b })) }));
}

function getLockState(state: GameState): LockState | undefined {
  const level = getLevelById(state.level);
  if (!level.lockedTubes || level.lockedTubes.length === 0) return undefined;
  return {
    lockedTubes: level.lockedTubes,
    completedCount: state.completedTubes.length,
    unlockAfterCompletions: level.unlockAfterCompletions,
  };
}

function buildInitialState(levelId: number): GameState {
  const level = getLevelById(levelId);
  return {
    tubes: cloneTubes(level.tubes),
    tray: level.tray.map((b) => ({ ...b })),
    score: 0,
    level: level.id,
    moves: 0,
    maxMoves: level.moves,
    selectedBall: null,
    gameOver: false,
    completedTubes: [],
    history: [],
    invalidPlacement: null,
    floatingPoints: [],
  };
}

interface GameStore extends GameState {
  progress: PlayerProgress;
  /** Selects or deselects a tray ball for the next placement. */
  selectBall: (ballId: string) => void;
  /** Attempts to place the currently selected tray ball into a bottle, applying rules and scoring. */
  placeBall: (tubeIndex: number) => boolean;
  /** Reverts the most recent placement, returning its ball to the tray. */
  undoLastPlacement: () => void;
  /** Resets the current level back to its starting configuration. */
  resetGame: () => void;
  /** Loads a specific level by id, resetting board state. */
  loadLevel: (levelId: number) => void;
  /** Clears the transient invalid-placement flag once its shake animation finishes. */
  clearInvalidPlacement: () => void;
  /** Removes a floating point popup once its rise/fade animation finishes. */
  dismissFloatingPoint: (id: string) => void;
}

/**
 * Global Zustand game store. Holds the live board state for the level in
 * progress and persists long-term player progress to AsyncStorage.
 */
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...buildInitialState(FIRST_LEVEL_ID),
      progress: {
        unlockedLevels: [FIRST_LEVEL_ID, BONUS_LEVEL_ID],
        levelProgress: {},
        bestScore: 0,
        levelsCompleted: 0,
        totalPlaytimeSeconds: 0,
        coins: 0,
      },

      selectBall: (ballId: string) => {
        const state = get();
        if (state.gameOver) return;
        if (!state.tray.some((b) => b.id === ballId)) return;
        set({ selectedBall: state.selectedBall === ballId ? null : ballId });
      },

      placeBall: (tubeIndex: number) => {
        const state = get();
        if (state.gameOver || !state.selectedBall) return false;

        const trayIndex = state.tray.findIndex((b) => b.id === state.selectedBall);
        if (trayIndex === -1) return false;
        const ball = state.tray[trayIndex];
        const targetTube = state.tubes[tubeIndex];

        if (!canPlaceBall(targetTube, ball.weight, getLockState(state), tubeIndex)) {
          set({ invalidPlacement: { tubeIndex, at: Date.now() } });
          return false;
        }

        const tubes = cloneTubes(state.tubes);
        tubes[tubeIndex].balls.push(ball);
        const tray = state.tray.filter((b) => b.id !== ball.id);
        const history = [...state.history, { ball, tubeIndex }];

        const floatingPoints: FloatingPointEvent[] = [];
        let score = state.score + calculatePlacementPoints();

        const completedTubes = [...state.completedTubes];
        if (isBottleComplete(tubes[tubeIndex]) && !completedTubes.includes(tubeIndex)) {
          completedTubes.push(tubeIndex);
          score += calculateBottleCompleteBonus();
          floatingPoints.push({
            id: nextFloatingPointId(),
            amount: calculateBottleCompleteBonus(),
            label: 'BOTTLE FULL',
            tubeIndex,
          });
        }

        const moves = state.moves + 1;
        const level = getLevelById(state.level);
        const won = tubes.every((tube) => isBottleComplete(tube));
        const stuck = !won && tray.length === 0;
        const outOfMoves = !won && moves >= state.maxMoves;
        const lost = stuck || outOfMoves;
        const gameOver = won || lost;

        if (won) {
          const remaining = state.maxMoves - moves;
          score += calculateLevelBonus() + calculateMoveBonus(remaining);
        }

        set((prev) => {
          const nextProgress = { ...prev.progress };
          if (won) {
            const stars = calculateStars(moves, level.minMoves);
            const existing = nextProgress.levelProgress[level.id];
            nextProgress.levelProgress = {
              ...nextProgress.levelProgress,
              [level.id]: {
                levelId: level.id,
                bestScore: Math.max(existing?.bestScore ?? 0, score),
                stars: Math.max(existing?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
                completed: true,
              },
            };
            if (!existing?.completed) {
              nextProgress.levelsCompleted += 1;
            }
            nextProgress.bestScore = Math.max(nextProgress.bestScore, score);
            nextProgress.coins = (nextProgress.coins ?? 0) + score;
            if (level.unlocks && !nextProgress.unlockedLevels.includes(level.unlocks)) {
              nextProgress.unlockedLevels = [...nextProgress.unlockedLevels, level.unlocks];
            }
          }

          return {
            tubes,
            tray,
            score,
            moves,
            completedTubes,
            gameOver,
            selectedBall: null,
            history,
            progress: nextProgress,
            floatingPoints: [...prev.floatingPoints, ...floatingPoints],
          };
        });

        return true;
      },

      undoLastPlacement: () => {
        const state = get();
        if (state.gameOver || state.history.length === 0) return;

        const lastMove = state.history[state.history.length - 1];
        const tubes = cloneTubes(state.tubes);
        const tube = tubes[lastMove.tubeIndex];
        const ballIdx = tube.balls.findIndex((b) => b.id === lastMove.ball.id);
        if (ballIdx === -1) return;
        tube.balls.splice(ballIdx, 1);

        set({
          tubes,
          tray: [...state.tray, lastMove.ball],
          history: state.history.slice(0, -1),
          moves: Math.max(0, state.moves - 1),
          completedTubes: state.completedTubes.filter((idx) => idx !== lastMove.tubeIndex),
          selectedBall: null,
        });
      },

      clearInvalidPlacement: () => {
        set({ invalidPlacement: null });
      },

      dismissFloatingPoint: (id: string) => {
        set((prev) => ({ floatingPoints: prev.floatingPoints.filter((fp) => fp.id !== id) }));
      },

      resetGame: () => {
        const state = get();
        set(buildInitialState(state.level));
      },

      loadLevel: (levelId: number) => {
        set(buildInitialState(levelId));
      },
    }),
    {
      name: STORAGE_KEY_PROGRESS,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ progress: state.progress }),
      // Ensure the bonus showcase level stays unlocked, and coins exists, even
      // for players with progress persisted from before either existed.
      merge: (persisted, current) => {
        const persistedProgress = (persisted as Partial<GameStore> | undefined)?.progress;
        const merged = { ...current, ...(persisted as object) };
        if (persistedProgress) {
          merged.progress = {
            ...current.progress,
            ...persistedProgress,
            coins: persistedProgress.coins ?? current.progress.coins,
            unlockedLevels: Array.from(
              new Set([...persistedProgress.unlockedLevels, BONUS_LEVEL_ID])
            ),
          };
        }
        return merged;
      },
    }
  )
);
