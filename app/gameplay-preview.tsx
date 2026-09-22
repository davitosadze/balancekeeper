import React, { useState } from 'react';
import type { BottleRect } from '@/components/GameBoard';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import GameplayScene from '@/components/gameplay/GameplayScene';
import SceneBackground from '@/components/SceneBackground';
import { useMusic } from '@/hooks/useMusic';
import type { Tube, Ball } from '@/types/game';

// Visual reference fixture only. It never loads or writes the player's store.
const tubes: Tube[] = [
  { index: 0, target: 7, balls: [{ id: 'blue-a', color: 'blue', weight: 2 }, { id: 'blue-b', color: 'blue', weight: 2 }] },
  { index: 1, target: 10, balls: [{ id: 'green-a', color: 'green', weight: 5 }, { id: 'red-a', color: 'red', weight: 3 }] },
  { index: 2, target: 15, balls: [] },
];
const balls: Ball[] = [
  { id: 'wood', color: 'yellow', weight: 1 }, { id: 'blue', color: 'blue', weight: 2 },
  { id: 'green', color: 'green', weight: 5 }, { id: 'red', color: 'red', weight: 10 }, { id: 'heavy', color: 'purple', weight: 15 },
];
export default function GameplayPreview() {
  const router = useRouter();
  const [rects, setRects] = useState<BottleRect[]>([]);
  useMusic('menu');
  const openGame = () => router.replace('/game');
  return <View style={{ flex: 1 }}><SceneBackground gameplay tabletopY={rects[0] ? rects[0].y + rects[0].height - 52 : undefined} /><SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
    <GameplayScene level={12} coins={320} progress={.6} stars={1} onPause={openGame} onCoins={openGame}
      actions={{ undo: { enabled: false, freeUses: 0, cost: 30 }, hint: { enabled: false, freeUses: 0, cost: 50 }, shuffle: { enabled: false, freeUses: 0, cost: 25 }, onUndo: openGame, onHint: openGame, onShuffle: openGame }}
      board={{ onBottleRects: setRects, tubes, validDropTargets: [], completedTubes: [], onTubePress: openGame, tubeDurability: [null, { current: 1, max: 3 }, null] }}
      tray={{ balls, selectedBallId: null, draggingBallId: null, onDragStart: openGame, onDragMove: () => {}, onDragEnd: () => {} }} />
  </SafeAreaView></View>;
}
