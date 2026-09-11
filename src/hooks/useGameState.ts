import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { saveProgress } from './useStorage';
import { getLevelById, getTotalLevels } from '@/data/levels';

/**
 * Gameplay-facing hook built on top of the Zustand game store. Wraps store
 * actions for ball selection/placement/undo and an auto-save of player
 * progress to AsyncStorage after every move.
 */
export function useGameState() {
  const gameState = useGameStore();
  const previousMoves = useRef(gameState.moves);

  useEffect(() => {
    if (gameState.moves !== previousMoves.current) {
      previousMoves.current = gameState.moves;
      void saveProgress(gameState.progress);
    }
  }, [gameState.moves, gameState.progress]);

  const handleSelectBall = useCallback((ballId: string) => {
    useGameStore.getState().selectBall(ballId);
  }, []);

  const handlePlaceBall = useCallback((tubeIndex: number): boolean => {
    return useGameStore.getState().placeBall(tubeIndex);
  }, []);

  const handleUndo = useCallback(() => {
    useGameStore.getState().undoLastPlacement();
  }, []);

  const handleResetGame = useCallback(() => {
    useGameStore.getState().resetGame();
  }, []);

  const handleNextLevel = useCallback(() => {
    const nextId = Math.min(gameState.level + 1, getTotalLevels());
    getLevelById(nextId);
    useGameStore.getState().loadLevel(nextId);
  }, [gameState.level]);

  return {
    gameState,
    handleSelectBall,
    handlePlaceBall,
    handleUndo,
    handleResetGame,
    handleNextLevel,
  };
}
