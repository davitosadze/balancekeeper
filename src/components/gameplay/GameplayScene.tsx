import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import GameBoard, { type GameBoardProps } from '../GameBoard';
import { BOTTLE_ASPECT } from './layout';
import BallTray, { type BallTrayProps } from '../BallTray';
import { TopHud } from './GameplayHud';
import GameplayActions, { type GameplayActionsProps } from './GameplayActions';

export interface GameplaySceneProps {
  combo?: string | null;
  feedback?: React.ReactNode;
  level: number;
  coins: number;
  progress: number;
  stars: number;
  board: GameBoardProps;
  tray: BallTrayProps;
  actions: GameplayActionsProps;
  onPause: () => void;
  onCoins: () => void;
}
/** Sections stay in flow; free space above the board keeps its feet on the table. */
export default function GameplayScene({ combo, feedback, level, coins, progress, stars, board, tray, actions, onPause, onCoins }: GameplaySceneProps) {
  const window = useWindowDimensions();
  const [layout, setLayout] = useState({ width: Math.min(window.width, 600), height: window.height });
  const w = layout.width;
  const h = layout.height;
  const compact = h < 680;
  const gap = compact ? 10 : 18;
  const boardWidth = w - 32;
  const naturalWidth = (boardWidth - Math.max(8, w * .025) * (board.tubes.length - 1)) / Math.max(1, board.tubes.length);
  const bottleHeight = Math.min(naturalWidth / BOTTLE_ASPECT, h * .37);
  return <View testID="gameplay-scene" onLayout={e => setLayout(e.nativeEvent.layout)} style={[styles.scene, { paddingTop: compact ? 6 : 10, paddingBottom: compact ? 6 : 14 }]}>
    <View style={styles.hud}><TopHud level={level} coins={coins} progress={progress} stars={stars} scale={w / 390} onPause={onPause} onCoins={onCoins} /></View>
    <View pointerEvents="none" style={{ height: 22, alignItems: "center", justifyContent: "center" }}>{feedback ?? <Text style={{ color: "#fff0d2", fontWeight: "600", fontSize: 12, textShadowColor: "#4a301c", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } }}>{combo ?? ""}</Text>}</View>
    <View style={styles.playSpace}>
      <GameBoard {...board} width={boardWidth} bottleHeight={bottleHeight} layoutHeight={h} />
    </View>
    <View style={{ marginTop: gap, alignSelf: 'center' }}><BallTray key={level} {...tray} width={w - 28} /></View>
    <View style={{ marginTop: gap }}><GameplayActions {...actions} /></View>
  </View>;
}
const styles = StyleSheet.create({
  scene: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', minHeight: 0 },
  hud: { marginHorizontal: 12 },
  playSpace: { flex: 1, justifyContent: 'flex-end', paddingTop: 12, minHeight: 0 },
});
