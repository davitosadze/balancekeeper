import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/gameStore';
import { getTotalLevels, getLevelById } from '@/data/levels';
import { initialGame } from '@/domain/gameplay';
import type { GameState } from '@/types/game';
const runtimeKeys = Object.keys(initialGame(getLevelById(1))) as (keyof GameState)[];
/** Runtime subscriptions exclude profile receipts, ownership and reward-save bookkeeping. */
export function useGameState() {
  const runtime = useGameStore(useShallow(state => ({
    ...Object.fromEntries(runtimeKeys.map(key => [key,state[key]])) as unknown as GameState,
    hydrated:state.hydrated,utilityBusy:state.utilityBusy,cosmeticBusy:state.cosmeticBusy,
    storageError:state.storageError,retrySave:state.retrySave,
  })));
  const coins=useGameStore(state=>state.progress.coins);
  const gameState=useMemo(()=>({...runtime,progress:{coins}}),[runtime,coins]);
  const handleSelectBall = useCallback((ballId: string) => useGameStore.getState().selectBall(ballId), []);
  const handlePlaceBall = useCallback((tubeIndex: number, impactVelocity?: number) => useGameStore.getState().placeBall(tubeIndex, impactVelocity), []);
  const handleUndo = useCallback(() => useGameStore.getState().undoLastPlacement(), []);
  const handleResetGame = useCallback(() => useGameStore.getState().resetGame(), []);
  const handleNextLevel = useCallback(() => useGameStore.getState().loadLevel(Math.min(gameState.level + 1, getTotalLevels())), [gameState.level]);
  return { gameState, handleSelectBall, handlePlaceBall, handleUndo, handleResetGame, handleNextLevel };
}
