import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import GameBoard, { type BottleRect } from '@/components/GameBoard';
import BallTray from '@/components/BallTray';
import Ball from '@/components/Ball';
import ScoreDisplay from '@/components/ScoreDisplay';
import SceneBackground from '@/components/SceneBackground';
import Button from '@/components/ui/Button';
import { useGameState } from '@/hooks/useGameState';
import { useHaptics } from '@/hooks/useHaptics';
import { useAudio } from '@/hooks/useAudio';
import { useGameStore } from '@/store/gameStore';
import { EVENT_MAP } from '@/utils/eventMap';
import { UI_COLORS, FONTS, HINTS_PER_LEVEL, HEADER_PILL_GRADIENT, getBallSize } from '@/utils/constants';
import { getLevelById } from '@/data/levels';
import { isTubeLocked, bottleWeight } from '@/utils/physics';
import type { Ball as BallType } from '@/types/game';

/** Dark glass pill used for every header chip: a gradient fill, a thin top sheen, and clipped rounded corners. */
function HeaderPill({
  children,
  style,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.headerPill, style]}
    >
      <LinearGradient colors={HEADER_PILL_GRADIENT} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.pillSheen} />
      {children}
    </Wrapper>
  );
}

function GameIcon({ name, color = '#f8fafc', size = 20 }: { name: 'pause' | 'bulb' | 'undo' | 'grid' | 'play' | 'refresh' | 'check' | 'lock'; color?: string; size?: number }) {
  if (name === 'pause') {
    return <View style={[styles.pauseIcon, { width: size, height: size }]}><View style={[styles.pauseBar, { backgroundColor: color }]} /><View style={[styles.pauseBar, { backgroundColor: color }]} /></View>;
  }
  if (name === 'bulb') {
    return <View style={[styles.bulbIcon, { width: size, height: size }]}><View style={[styles.bulbHead, { borderColor: color }]} /><View style={[styles.bulbBase, { backgroundColor: color }]} /></View>;
  }
  if (name === 'undo') {
    return <View style={[styles.undoMark, { borderColor: color, width: size, height: size }]}><View style={[styles.undoArrow, { borderLeftColor: color, borderBottomColor: color }]} /></View>;
  }
  if (name === 'grid') {
    return <View style={[styles.gridIcon, { width: size, height: size }]}>{[0, 1, 2, 3].map((cell) => <View key={cell} style={[styles.gridCell, { backgroundColor: color }]} />)}</View>;
  }
  if (name === 'play') {
    return <View style={[styles.playIcon, { borderLeftColor: color, borderTopWidth: size * 0.35, borderBottomWidth: size * 0.35, borderLeftWidth: size * 0.55 }]} />;
  }
  if (name === 'refresh') {
    return <Text style={[styles.symbolIcon, { color, fontSize: size + 3 }]}>↻</Text>;
  }
  if (name === 'check') {
    return <Text style={[styles.symbolIcon, { color, fontSize: size }]}>✓</Text>;
  }
  return <View style={[styles.lockIcon, { width: size, height: size }]}><View style={[styles.lockShackle, { borderColor: color }]} /><View style={[styles.lockBody, { backgroundColor: color }]} /></View>;
}

/**
 * Primary gameplay screen: pause/level/moves/coins header, the bottle board,
 * the shared ball tray, and an undo control. Tap a tray ball to select it,
 * then tap a bottle to drop it in. Shows a game-over overlay when the level
 * is won or the move budget runs out, and a pause overlay with restart /
 * level-select navigation.
 */
/**
 * Fraction of screen height where the bottles' pedestal should sit, tuned to
 * the ghost bottle-base marks baked into assets/game-background.jpeg (the
 * photo's table only occupies its bottom ~35%, with the marks starting
 * around 76% down) so the rendered bottles look like they're actually
 * resting on the photographed table rather than floating over the lake.
 */
const PEDESTAL_TARGET_Y_FRACTION = 0.74;

/**
 * Distance (px) from the GameBoard's own top edge down to each bottle's
 * pedestal bottom: GameBoard's marginTop (28) + height (290) - paddingBottom
 * (20), per its own styles. Kept in sync with GameBoard.tsx by hand since
 * the board's height is fixed rather than measured.
 */
const BOARD_TOP_TO_PEDESTAL_BOTTOM = 298;

export default function Gameplay() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const { gameState, handleSelectBall, handlePlaceBall, handleUndo, handleResetGame } = useGameState();
  const { triggerHaptic } = useHaptics();
  const { playSound } = useAudio();
  const level = getLevelById(gameState.level);
  const won = gameState.completedTubes.length >= gameState.tubes.length;
  const [paused, setPaused] = useState(false);
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_LEVEL);
  const [hintIndex, setHintIndex] = useState(0);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [bottleRects, setBottleRects] = useState<BottleRect[]>([]);
  const [topBlockHeight, setTopBlockHeight] = useState(0);
  const [draggingBall, setDraggingBall] = useState<{ ball: BallType; x: number; y: number } | null>(null);
  const rootRef = useRef<View>(null);
  const rootPage = useRef({ x: 0, y: 0 });
  const wasSelectedOnDragStart = useRef(false);

  const boardSpacerHeight = Math.max(
    0,
    windowHeight * PEDESTAL_TARGET_Y_FRACTION - topBlockHeight - BOARD_TOP_TO_PEDESTAL_BOTTOM
  );

  const lockedTubeIndices = (level.lockedTubes ?? []).filter((idx) =>
    isTubeLocked(idx, level.lockedTubes, gameState.completedTubes.length, level.unlockAfterCompletions)
  );

  const selectedBall = gameState.tray.find((b) => b.id === gameState.selectedBall) ?? null;
  const validDropTargets = selectedBall
    ? gameState.tubes
        .map((tube, idx) => ({ idx, ok: !lockedTubeIndices.includes(idx) && bottleWeight(tube) + selectedBall.weight <= tube.target }))
        .filter((t) => t.ok)
        .map((t) => t.idx)
    : [];

  const fire = (event: keyof typeof EVENT_MAP) => {
    const feedback = EVENT_MAP[event];
    if (feedback.haptic) triggerHaptic(feedback.haptic);
    if (feedback.sound) void playSound(feedback.sound);
  };

  useEffect(() => {
    if (gameState.gameOver) {
      fire(won ? 'levelComplete' : 'levelFailed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.gameOver, won]);

  useEffect(() => {
    if (gameState.invalidPlacement) {
      fire('invalidPlacement');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.invalidPlacement]);

  const seenFloatingPoints = useRef(new Set<string>());
  useEffect(() => {
    for (const fp of gameState.floatingPoints) {
      if (seenFloatingPoints.current.has(fp.id)) continue;
      seenFloatingPoints.current.add(fp.id);
      if (fp.label === 'BOTTLE FULL') fire('bottleComplete');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.floatingPoints]);

  useEffect(() => {
    setHintsLeft(HINTS_PER_LEVEL);
    setHintIndex(0);
    setActiveHint(null);
  }, [level.id]);

  const selectDirect = (ballId: string) => {
    if (useGameStore.getState().selectedBall !== ballId) handleSelectBall(ballId);
  };

  const deselectDirect = (ballId: string) => {
    if (useGameStore.getState().selectedBall === ballId) handleSelectBall(ballId);
  };

  const handleRootLayout = (_event: LayoutChangeEvent) => {
    rootRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      rootPage.current = { x: pageX, y: pageY };
    });
  };

  const onDragStart = (ball: BallType, pageX: number, pageY: number) => {
    wasSelectedOnDragStart.current = useGameStore.getState().selectedBall === ball.id;
    fire('lightTap');
    selectDirect(ball.id);
    setDraggingBall({ ball, x: pageX, y: pageY });
  };

  const onDragMove = (pageX: number, pageY: number) => {
    setDraggingBall((prev) => (prev ? { ...prev, x: pageX, y: pageY } : prev));
  };

  const onDragEnd = (pageX: number, pageY: number, moved: boolean) => {
    const ball = draggingBall?.ball;
    setDraggingBall(null);
    if (!ball) return;

    if (!moved) {
      // A plain tap: leave it selected (already done on start) unless it was already
      // selected before this tap, in which case tapping it again toggles it off.
      if (wasSelectedOnDragStart.current) deselectDirect(ball.id);
      return;
    }

    const targetIndex = bottleRects.findIndex(
      (r) => pageX >= r.x && pageX <= r.x + r.width && pageY >= r.y && pageY <= r.y + r.height
    );
    if (targetIndex !== -1) {
      const success = handlePlaceBall(targetIndex);
      if (success) fire('ballPlaced');
    } else {
      deselectDirect(ball.id);
    }
  };

  const onBottlePress = (index: number) => {
    if (!gameState.selectedBall) return;
    const success = handlePlaceBall(index);
    if (success) fire('ballPlaced');
  };

  const onUndo = () => {
    if (gameState.history.length === 0) return;
    fire('undo');
    handleUndo();
  };

  const onHint = () => {
    if (hintsLeft <= 0 || level.hints.length === 0) return;
    setActiveHint(level.hints[hintIndex % level.hints.length]);
    setHintIndex((i) => i + 1);
    setHintsLeft((n) => n - 1);
  };

  const handleInvalidPlacementEnd = () => {
    useGameStore.getState().clearInvalidPlacement();
  };

  const handleDismissFloatingPoint = (id: string) => {
    useGameStore.getState().dismissFloatingPoint(id);
  };

  return (
    <View ref={rootRef} style={styles.root} onLayout={handleRootLayout} collapsable={false}>
      <SceneBackground />
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
      <View onLayout={(e) => setTopBlockHeight(e.nativeEvent.layout.height)}>
        <View style={styles.headerRow}>
          <HeaderPill onPress={() => setPaused(true)} accessibilityLabel="Pause" style={styles.iconButton}>
            <GameIcon name="pause" size={18} />
          </HeaderPill>

          <HeaderPill style={styles.levelPill}>
            <Text style={styles.levelPillTitle}>Level {level.id}</Text>
          </HeaderPill>

          <HeaderPill style={styles.movesPill}>
            <Text style={styles.movesPillLabel}>MOVES LEFT</Text>
            <Text style={styles.movesPillValue}>
              {Math.max(0, gameState.maxMoves - gameState.moves)}
            </Text>
          </HeaderPill>

          <ScoreDisplay score={gameState.progress.coins} />
        </View>

        <View style={styles.secondRow}>
          <HeaderPill
            onPress={onHint}
            disabled={hintsLeft <= 0}
            style={[styles.hintButton, hintsLeft <= 0 && styles.disabled]}
          >
            <View style={styles.hintIcon}><GameIcon name="bulb" color="#fcd34d" size={18} /></View>
            <Text style={styles.hintLabel}>Hint</Text>
            <View style={styles.hintBadge}>
              <Text style={styles.hintBadgeText}>{hintsLeft}</Text>
            </View>
          </HeaderPill>

        </View>

        {activeHint && (
          <Pressable onPress={() => setActiveHint(null)} style={styles.hintPanel}>
            <Text style={styles.hintPanelText}>{activeHint}</Text>
          </Pressable>
        )}
      </View>

      <View style={{ height: boardSpacerHeight }} />

      <GameBoard
        tubes={gameState.tubes}
        validDropTargets={validDropTargets}
        completedTubes={gameState.completedTubes}
        onTubePress={onBottlePress}
        invalidPlacement={gameState.invalidPlacement}
        onInvalidPlacementEnd={handleInvalidPlacementEnd}
        floatingPoints={gameState.floatingPoints}
        onDismissFloatingPoint={handleDismissFloatingPoint}
        lockedTubeIndices={lockedTubeIndices}
        onBottleRects={setBottleRects}
      />

      <BallTray
        balls={gameState.tray}
        selectedBallId={gameState.selectedBall}
        draggingBallId={draggingBall?.ball.id ?? null}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/level-select')}
          accessibilityRole="button"
          accessibilityLabel="Open level map"
          style={styles.mapButton}
        >
          <GameIcon name="grid" color="#dcecf0" size={20} />
        </Pressable>
        <Pressable
          onPress={onUndo}
          disabled={gameState.history.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Undo last move"
          hitSlop={12}
          pressRetentionOffset={12}
          style={[styles.undoButton, gameState.history.length === 0 && styles.disabled]}
        >
          <GameIcon name="undo" color="#f8fafc" size={21} />
        </Pressable>
      </View>

      </ScrollView>

      {paused && !gameState.gameOver && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <View style={styles.overlayIconCircle}><GameIcon name="pause" color="#fcd34d" size={22} /></View>
            <Text style={styles.overlayEyebrow}>GAME ON HOLD</Text>
            <Text style={styles.overlayTitle}>Take a breath</Text>
            <Text style={styles.overlayCopy}>Your bottles are waiting for the perfect balance.</Text>
            <Button label="RESUME PLAY" variant="primary" onPress={() => setPaused(false)} style={styles.overlayButton} />
            <Button
              label="RESTART LEVEL"
              variant="secondary"
              onPress={() => {
                handleResetGame();
                setPaused(false);
              }}
              style={styles.overlayButton}
            />
            <Button
              label="LEVEL MAP"
              variant="secondary"
              onPress={() => router.push('/level-select')}
              style={styles.overlayButton}
            />
          </View>
        </View>
      )}

      {gameState.gameOver && (
        <View style={styles.overlay}>
          <View style={[styles.overlayCard, { borderColor: won ? '#10b981' : '#ef4444' }]}>
            <View style={[styles.overlayBanner, { backgroundColor: won ? '#10b981' : '#ef4444' }]}>
              <View style={styles.resultIcon}><GameIcon name={won ? 'check' : 'refresh'} color="#ffffff" size={22} /></View>
              <Text style={styles.overlayBannerText}>{won ? 'BALANCE FOUND' : 'TRY AGAIN'}</Text>
            </View>
            <Text style={styles.overlaySubtitle}>{won ? 'Every bottle is perfectly balanced.' : 'The move counter ran dry.'}</Text>
            <View style={styles.scorePanel}>
              <Text style={styles.scoreLabel}>FINAL SCORE</Text>
              <Text style={styles.overlayScore}>{gameState.score.toLocaleString()}</Text>
            </View>
            <Button
              label={won ? 'VIEW REWARD' : 'TRY LEVEL AGAIN'}
              variant={won ? 'primary' : 'danger'}
              onPress={() => router.push('/level-complete')}
              style={styles.overlayActionButton}
            />
          </View>
        </View>
      )}
    </SafeAreaView>

    {draggingBall && (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: 'absolute',
            left: draggingBall.x - rootPage.current.x - getBallSize(draggingBall.ball.weight) / 2,
            top: draggingBall.y - rootPage.current.y - getBallSize(draggingBall.ball.weight) / 2,
          }}
        >
          <Ball color={draggingBall.ball.color} weight={draggingBall.ball.weight} />
        </View>
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 9,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 9,
    paddingBottom: 18,
  },
  headerPill: {
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillSheen: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconButtonText: {
    color: '#f1f5f9',
    fontSize: 18,
  },
  levelPill: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  levelPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelPillTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontFamily: FONTS.displayBold,
  },
  levelPillStars: {
    color: '#fbbf24',
    fontSize: 13,
  },
  levelPillSubtitle: {
    color: '#a7f3d0',
    fontSize: 11,
    fontFamily: FONTS.displayMedium,
  },
  movesPill: {
    borderRadius: 24,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  movesPillLabel: {
    color: '#94a3b8',
    fontSize: 8,
    letterSpacing: 1,
    fontFamily: FONTS.displaySemiBold,
  },
  movesPillValue: {
    color: '#fcd34d',
    fontSize: 18,
    fontFamily: FONTS.displayBold,
  },
  secondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 38,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hintIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintLabel: {
    color: '#f1f5f9',
    fontSize: 14,
    fontFamily: FONTS.displaySemiBold,
  },
  hintBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  hintBadgeText: {
    color: '#1e293b',
    fontSize: 11,
    fontFamily: FONTS.displayBold,
  },
  disabled: {
    opacity: 0.45,
  },
  hintPanel: {
    backgroundColor: 'rgba(10, 32, 43, 0.94)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.55)',
    shadowColor: '#0f766e',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  hintPanelText: {
    color: '#ccfbf1',
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 6,
    justifyContent: 'flex-end',
    alignSelf: 'center',
  },
  mapButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(38, 52, 58, 0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  undoButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#173246',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 18, 29, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCard: {
    backgroundColor: '#102536',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    padding: 26,
    alignItems: 'center',
    gap: 10,
    minWidth: 286,
    maxWidth: 340,
    overflow: 'hidden',
  },
  overlayTitle: {
    color: UI_COLORS.text,
    fontSize: 25,
    fontFamily: FONTS.displayBold,
    marginBottom: 8,
  },
  overlayButton: {
    minWidth: 220,
  },
  overlayBanner: {
    alignSelf: 'stretch',
    marginHorizontal: -24,
    marginTop: -24,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 5,
  },
  overlayBannerText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: FONTS.displayBold,
    letterSpacing: 0.5,
  },
  overlaySubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
  overlayScore: {
    color: UI_COLORS.text,
    fontSize: 25,
    fontFamily: FONTS.displaySemiBold,
  },
  overlayActionButton: {
    marginTop: 8,
    minWidth: 180,
  },
  overlayIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayEyebrow: {
    color: '#fcd34d',
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: FONTS.displayBold,
  },
  overlayCopy: {
    color: '#9fb5c4',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -3,
    marginBottom: 5,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 9,
    marginTop: 5,
  },
  scoreLabel: {
    color: '#86a4b5',
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: FONTS.displaySemiBold,
  },
  pauseIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 15,
    borderRadius: 2,
  },
  bulbIcon: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bulbHead: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  bulbBase: {
    width: 8,
    height: 3,
    borderRadius: 1,
    marginTop: -1,
  },
  undoMark: {
    borderWidth: 2,
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderRadius: 12,
    transform: [{ rotate: '25deg' }],
  },
  undoArrow: {
    position: 'absolute',
    left: -3,
    top: 1,
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '35deg' }],
  },
  gridIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 2,
  },
  gridCell: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightWidth: 0,
  },
  symbolIcon: {
    fontFamily: FONTS.displayBold,
    lineHeight: 24,
  },
  lockIcon: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  lockShackle: {
    width: 11,
    height: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  lockBody: {
    width: 17,
    height: 13,
    borderRadius: 3,
  },
});
