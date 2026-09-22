import { recordRender } from '@/utils/performance';
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { useRouter, useFocusEffect } from "expo-router";
import { type BottleRect } from "@/components/GameBoard";
import GameplayScene from "@/components/gameplay/GameplayScene";
import { trayBallSize, GAME_FONT } from "@/components/gameplay/assets";
import { WoodPanel, WoodButton, WOODLAND } from "@/components/ui/Woodland";
import ReturningWeight, {
  RETURN_DURATION,
} from "@/components/gameplay/ReturningWeight";
import { useStableCallback } from '@/hooks/useStableCallback';
import GameplayAssetWarmup from '@/components/gameplay/GameplayAssetWarmup';
import FailureScreen from '@/components/gameplay/FailureScreen';
import { THEME } from '@/components/ui/theme';
import Ball from "@/components/Ball";
import Confetti from "@/components/Confetti";
import SceneBackground from "@/components/SceneBackground";
import Button from "@/components/ui/Button";
import { useGameState } from "@/hooks/useGameState";
import { useRewardedAd } from '@/hooks/useRewardedAd';
import { useGameplayFeedback } from "@/hooks/useGameplayFeedback";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { EFFECT_TIMING } from "@/domain/bottleFeedback";
import GameplayBanner from "@/components/gameplay/GameplayBanner";
import { useHaptics } from "@/hooks/useHaptics";
import { useAudio } from "@/hooks/useAudio";
import { useMusic } from "@/hooks/useMusic";
import { useGameStore } from "@/store/gameStore";
import { EVENT_MAP } from "@/utils/eventMap";
import { UI_COLORS, FONTS, DURABILITY_CONFIG } from "@/utils/constants";
import { getLevelById } from "@/data/levels";
import { getLockedBottleIndices, getRejectionReason } from "@/utils/physics";
import { canRevive, gameplayActions } from "@/domain/gameplay";
import { getTutorialMessage, getMoveGoalText } from "@/domain/levels/tutorials";
import TutorialCoach from "@/components/gameplay/TutorialCoach";
import { comboLabel } from "@/utils/scoring";
import type {
  Ball as BallType,
} from "@/types/game";


// The dragged ball follows the finger every frame; caching it as a rasterized texture avoids
// re-rendering its image and shadow 60 times a second while it moves.
const RASTERIZE_PROPS = Platform.OS === "android"
  ? { renderToHardwareTextureAndroid: true }
  : { shouldRasterizeIOS: true };

function GameIcon({
  name,
  color = "#f8fafc",
  size = 20,
}: {
  name:
    | "pause"
    | "bulb"
    | "undo"
    | "grid"
    | "play"
    | "refresh"
    | "check"
    | "lock";
  color?: string;
  size?: number;
}) {
  if (name === "pause") {
    return (
      <View style={[styles.pauseIcon, { width: size, height: size }]}>
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
      </View>
    );
  }
  if (name === "bulb") {
    return (
      <View style={[styles.bulbIcon, { width: size, height: size }]}>
        <View style={[styles.bulbHead, { borderColor: color }]} />
        <View style={[styles.bulbBase, { backgroundColor: color }]} />
      </View>
    );
  }
  if (name === "undo") {
    return (
      <View
        style={[
          styles.undoMark,
          { borderColor: color, width: size, height: size },
        ]}>
        <View
          style={[
            styles.undoArrow,
            { borderLeftColor: color, borderBottomColor: color },
          ]}
        />
      </View>
    );
  }
  if (name === "grid") {
    return (
      <View style={[styles.gridIcon, { width: size, height: size }]}>
        {[0, 1, 2, 3].map((cell) => (
          <View
            key={cell}
            style={[styles.gridCell, { backgroundColor: color }]}
          />
        ))}
      </View>
    );
  }
  if (name === "play") {
    return (
      <View
        style={[
          styles.playIcon,
          {
            borderLeftColor: color,
            borderTopWidth: size * 0.35,
            borderBottomWidth: size * 0.35,
            borderLeftWidth: size * 0.55,
          },
        ]}
      />
    );
  }
  if (name === "refresh") {
    return (
      <Text style={[styles.symbolIcon, { color, fontSize: size + 3 }]}>↻</Text>
    );
  }
  if (name === "check") {
    return (
      <Text style={[styles.symbolIcon, { color, fontSize: size }]}>✓</Text>
    );
  }
  return (
    <View style={[styles.lockIcon, { width: size, height: size }]}>
      <View style={[styles.lockShackle, { borderColor: color }]} />
      <View style={[styles.lockBody, { backgroundColor: color }]} />
    </View>
  );
}

export default function Gameplay() {
  recordRender('gameplay');
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const sceneWidth = Math.min(windowWidth, 600);
  const {
    gameState,
    handleSelectBall,
    handlePlaceBall,
    handleUndo,
    handleResetGame,
  } = useGameState();
  const { triggerHaptic } = useHaptics();
  const rewardedAd = useRewardedAd();
  const [adNotice, setAdNotice] = useState<string | null>(null);
  useEffect(() => { setAdNotice(null); }, [gameState.attemptId]);
  const { playSound } = useAudio();
  const reducedMotion = useReducedMotionPreference();
  const level = getLevelById(gameState.level);
  useMusic(level.category === "hard" || level.category === "challenge" ? "gameplayHard" : "gameplay");
  const won = gameState.status === "won";
  const gameOver = gameState.status !== "playing";
  const completedTubes = useMemo(() => gameState.tubes
    .filter((tube) => tube.isSolved)
    .map((tube) => tube.index), [gameState.tubes]);
  const brokenTubes = useMemo(() => gameState.tubes
    .filter((tube) => tube.isBroken)
    .map((tube) => tube.index), [gameState.tubes]);
  const actions = gameplayActions(gameState, level, gameState.progress.coins);
  const reviveAvailable = canRevive(gameState);
  const reviveCost = level.rules.reviveCost;
  const [paused, setPaused] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [assetRetry, setAssetRetry] = useState(0);
  const handleAssetError = useCallback(() => setAssetError(true), []);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [bottleRects, setBottleRects] = useState<BottleRect[]>([]);
  const [coinInfo, setCoinInfo] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const dragRenderSize = useRef(0);
  const [hoveredBottle, setHoveredBottle] = useState(-1);
  const draggedBallRef = useRef<BallType | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const [draggingBall, setDraggingBall] = useState<{
    ball: BallType;
    x: number;
    y: number;
  } | null>(null);
  const [rejectedBall, setRejectedBall] = useState<{
    ball: BallType;
    from: { x: number; y: number };
    to: { x: number; y: number };
    at: number;
  } | null>(null);
  const rootRef = useRef<View>(null);
  const rootPage = useRef({ x: 0, y: 0 });
  const wasSelectedOnDragStart = useRef(false);
  const screenFlashOpacity = useSharedValue(0);
  const originX = useSharedValue(0), originY = useSharedValue(0);
  const hover = useSharedValue(-1), rects = useSharedValue<BottleRect[]>([]);
  useEffect(() => { rects.value = bottleRects; }, [bottleRects,rects]);
  const motion = useMemo(() => ({x:dragX,y:dragY,originX,originY,hover,rects}),[dragX,dragY,originX,originY,hover,rects]);

  useEffect(() => () => { [dragX, dragY, dragScale, screenFlashOpacity].forEach(cancelAnimation); }, [dragX, dragY, dragScale, screenFlashOpacity]);

  const lockedTubeIndices = useMemo(() => getLockedBottleIndices(gameState.tubes), [gameState.tubes]);

  const selectedBall =
    gameState.tray.find((b) => b.id === gameState.selectedBall) ?? null;
  const validDropTargets = useMemo(() => selectedBall
    ? gameState.tubes
        .map((tube, idx) => ({
          idx,
          ok:
            !lockedTubeIndices.includes(idx) &&
            !brokenTubes.includes(idx) &&
            getRejectionReason(tube, selectedBall.weight, {
              bottles: gameState.tubes,
            }) === null,
        }))
        .filter((t) => t.ok)
        .map((t) => t.idx)
    : [], [selectedBall, gameState.tubes, lockedTubeIndices, brokenTubes]);

  const tubeDurability = useMemo(() => gameState.tubes.map((tube) =>
    tube.durability == null
      ? null
      : {
          current: Math.max(0, tube.durability - tube.damage),
          max: tube.durability,
        },
  ), [gameState.tubes]);

  // A bottle-break failure holds the result overlay back until the shatter
  // animation (lastBreak, cleared by GameBoard after breakAnimationDurationMs)
  // has actually played, so the player sees CRACK...CRACK...SHATTER before
  // "LEVEL FAILED" covers the screen. Every other outcome reveals instantly.
  const resultOverlayReady =
    won || gameState.lossReason !== "broken" || !gameState.lastBreak;
  const showResultOverlay = gameState.status === "lost" && resultOverlayReady;

  const fire = (event: keyof typeof EVENT_MAP) => {
    const feedback = EVENT_MAP[event];
    if (feedback.haptic) triggerHaptic(feedback.haptic);
    if (feedback.sound) void playSound(feedback.sound);
  };

  useGameplayFeedback(gameState.effects, playSound, triggerHaptic, !paused);

  useFocusEffect(
    useCallback(() => {
      if (!won) return;
      const timer = setTimeout(() => router.replace("/level-complete"), reducedMotion ? 150 : EFFECT_TIMING.win);
      return () => clearTimeout(timer);
    }, [won, router, reducedMotion]),
  );

  useEffect(() => {
    if (!gameState.lastBreak || reducedMotion) return;
    screenFlashOpacity.value = 0;
    screenFlashOpacity.value = withSequence(
      withTiming(0.16, { duration: 55, easing: Easing.out(Easing.quad) }),
      withTiming(0, {
        duration: DURABILITY_CONFIG.screenFlashDurationMs,
        easing: Easing.out(Easing.quad),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.lastBreak]);

  const screenFlashStyle = useAnimatedStyle(() => ({
    opacity: screenFlashOpacity.value,
  }));

  useEffect(() => {
    if (!rejectedBall) return;
    const timer = setTimeout(() => setRejectedBall(null), RETURN_DURATION);
    return () => clearTimeout(timer);
  }, [rejectedBall]);

  useEffect(() => {
    setActiveHint(null);
  }, [level.id]);

  const selectDirect = (ballId: string) => {
    if (useGameStore.getState().selectedBall !== ballId)
      handleSelectBall(ballId);
  };

  const deselectDirect = (ballId: string) => {
    if (useGameStore.getState().selectedBall === ballId)
      handleSelectBall(ballId);
  };

  const handleRootLayout = (_event: LayoutChangeEvent) => {
    rootRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      rootPage.current = { x: pageX, y: pageY };
      originX.value = pageX; originY.value = pageY;
    });
  };

  const onDragStart = useStableCallback((
    ball: BallType,
    pageX: number,
    pageY: number,
    origin?: { x: number; y: number; size?: number },
  ) => {
    if (!assetsReady || paused || gameOver || !gameState.hydrated || gameState.cosmeticBusy || gameState.storageError)
      return;
    dragOrigin.current = origin ?? { x: pageX, y: pageY };
    dragRenderSize.current =
      origin?.size ?? trayBallSize(ball.weight, sceneWidth);
    setHoveredBottle(-1);
    hover.value = -1;
    setRejectedBall(null);
    wasSelectedOnDragStart.current =
      useGameStore.getState().selectedBall === ball.id;
    selectDirect(ball.id);
    draggedBallRef.current = ball;
    dragX.value = pageX - rootPage.current.x;
    dragY.value = pageY - rootPage.current.y;
    dragScale.value = 1;
    dragScale.value = reducedMotion ? 1 : withTiming(1.1, { duration: 120 });
    setDraggingBall({ ball, x: pageX, y: pageY });
  });

  const onDragMove = useStableCallback((pageX: number, pageY: number) => {
    // Visual hover feedback only; onDragEnd remains the placement authority.
    if (draggedBallRef.current)
      setHoveredBottle(
        bottleRects.findIndex(
          (rect) =>
            pageX >= rect.x &&
            pageX <= rect.x + rect.width &&
            pageY >= rect.y &&
            pageY <= rect.y + rect.height,
        ),
      );
    dragX.value = pageX - rootPage.current.x;
    dragY.value = pageY - rootPage.current.y;
  });

  const onDragEnd = useStableCallback((pageX: number, pageY: number, moved: boolean) => {
    setHoveredBottle(-1);
    hover.value = -1;
    const ball = draggedBallRef.current;
    draggedBallRef.current = null;
    setDraggingBall(null);
    if (!ball) return;

    if (!moved) {
      // A plain tap: leave it selected (already done on start) unless it was already
      // selected before this tap, in which case tapping it again toggles it off.
      if (wasSelectedOnDragStart.current) deselectDirect(ball.id);
      return;
    }

    const targetIndex = bottleRects.findIndex(
      (r) =>
        pageX >= r.x &&
        pageX <= r.x + r.width &&
        pageY >= r.y &&
        pageY <= r.y + r.height,
    );
    if (targetIndex !== -1) {
      const success = handlePlaceBall(targetIndex);
      if (success) {
        return;
      }
    } else {
      useGameStore.getState().invalidDrop();
    }
    // Keep the tray slot empty until the object arrives back at its origin.
    // Rejections always leave the offending ball in the tray.
    if (useGameStore.getState().tray.some((item) => item.id === ball.id)) {
      setRejectedBall({
        ball,
        from: { x: pageX - rootPage.current.x, y: pageY - rootPage.current.y },
        to: {
          x: dragOrigin.current.x - rootPage.current.x,
          y: dragOrigin.current.y - rootPage.current.y,
        },
        at: Date.now(),
      });
    }
  });

  const onDragCancel = useStableCallback(() => {
    if (draggedBallRef.current)
      onDragEnd(dragOrigin.current.x, dragOrigin.current.y, true);
  });

  const onBottlePress = useStableCallback((index: number) => {
    if (!gameState.selectedBall) return;
    handlePlaceBall(index);
  });

  const onUndo = useStableCallback(() => {
    const result = handleUndo();
    if (result.accepted) {
      setActiveHint(null);
    } else if (result.message) setActiveHint(result.message);
  });
  const onHint = useStableCallback(() => {
    const result = useGameStore.getState().requestHint();
    if (result.accepted) {
      setActiveHint(null);
    } else if (result.message) setActiveHint(result.message);
  });
  const onShuffle = useStableCallback(() => {
    const result = useGameStore.getState().shuffleTray();
    if (result.accepted) {
      setActiveHint(null);
    } else if (result.message) setActiveHint(result.message);
  });
  const onRevive = useStableCallback(() => {
    const result = useGameStore.getState().revive();
    if (result.accepted) {
      setRejectedBall(null);
      setActiveHint(null);
    } else if (result.message) setActiveHint(result.message);
  });
  const onRewardedRevive = useStableCallback(() => {
    const attemptId = useGameStore.getState().attemptId;
    const isValid = () => {
      const state = useGameStore.getState();
      return state.attemptId === attemptId && canRevive(state) && state.hydrated
        && !state.utilityBusy && !state.cosmeticBusy && !state.storageError;
    };
    setAdNotice(null);
    void rewardedAd.show({
      isValid,
      onEarned: () => {
        const result = useGameStore.getState().reviveWithEarnedReward(attemptId);
        if (result.accepted) { setRejectedBall(null); setActiveHint(null); }
        else setAdNotice(result.message ?? 'Continue is no longer available.');
      },
      onDismissed: earned => { if (!earned) setAdNotice('Ad closed before the reward was earned.'); },
      onError: () => setAdNotice('Ad unavailable. You can still continue with coins or restart.'),
    });
  });

  const handleInvalidPlacementEnd = useStableCallback(() => {
    useGameStore.getState().clearInvalidPlacement();
  });

  const handleDismissFloatingPoint = useStableCallback((id: string) => {
    useGameStore.getState().dismissFloatingPoint(id);
  });

  const draggedSize = draggingBall ? dragRenderSize.current : 0;
  const draggedHeight =
    draggedSize * (draggingBall && draggingBall.ball.weight >= 15 ? 1.3 : 1);
  const draggedStyle = useAnimatedStyle(() => ({
    left: 0, top: 0,
    transform: [{ translateX: dragX.value - draggedSize / 2 }, { translateY: dragY.value - draggedHeight / 2 - 8 }, { scale: dragScale.value }],
  }));

  const onPause = useStableCallback(() => {fire('lightTap');setPaused(true);});
  const onCoins = useStableCallback(() => {fire('lightTap');setCoinInfo(true);});
  const onImpactEnd = useCallback(() => useGameStore.getState().clearImpact(), []);
  const onBreakEnd = useCallback(() => useGameStore.getState().clearBreak(), []);

  const actionsDisabled =
    !assetsReady || paused ||
    gameOver ||
    !!draggingBall ||
    !gameState.hydrated ||
    gameState.cosmeticBusy ||
    gameState.utilityBusy ||
    !!gameState.storageError;
  // Stable prop objects let GameBoard/BallTray's React.memo actually skip re-rendering (and
  // re-creating every drag gesture handler) on state changes unrelated to the board or tray,
  // which otherwise re-ran every bottle and ball slot on each dispatch, most visibly at drop time.
  const sceneActions = useMemo(() => ({
    ...actions, onUndo, onHint, onShuffle, disabled: actionsDisabled,
  }), [actions, onUndo, onHint, onShuffle, actionsDisabled]);
  const sceneBoard = useMemo(() => ({
    effects: gameState.effects,
    won,
    hoveredIndex: hoveredBottle,
    hintIndex: gameState.hintMove?.tubeIndex,
    dragActive: !!draggingBall,
    tubes: gameState.tubes,
    validDropTargets,
    completedTubes,
    onTubePress: onBottlePress,
    invalidPlacement: gameState.invalidPlacement,
    onInvalidPlacementEnd: handleInvalidPlacementEnd,
    floatingPoints: gameState.floatingPoints,
    onDismissFloatingPoint: handleDismissFloatingPoint,
    lockedTubeIndices,
    onBottleRects: setBottleRects,
    tubeDurability,
    brokenTubeIndices: brokenTubes,
    lastImpact: gameState.lastImpact,
    onImpactEnd,
    lastBreak: gameState.lastBreak,
    onBreakEnd,
  }), [
    gameState.effects, won, hoveredBottle, gameState.hintMove?.tubeIndex, draggingBall,
    gameState.tubes, validDropTargets, completedTubes, onBottlePress,
    gameState.invalidPlacement, handleInvalidPlacementEnd, gameState.floatingPoints,
    handleDismissFloatingPoint, lockedTubeIndices, tubeDurability, brokenTubes,
    gameState.lastImpact, onImpactEnd, gameState.lastBreak, onBreakEnd,
  ]);
  const sceneTray = useMemo(() => ({
    balls: gameState.tray,
    selectedBallId: gameState.selectedBall,
    hintedBallId: gameState.hintMove?.ballId,
    hintVersion: gameState.hintUsed,
    draggingBallId: draggingBall?.ball.id ?? rejectedBall?.ball.id ?? null,
    onDragStart,
    onDragMove,
    motion, onHover: setHoveredBottle,
    onDragEnd,
    onDragCancel,
  }), [
    gameState.tray, gameState.selectedBall, gameState.hintMove?.ballId, gameState.hintUsed,
    draggingBall, rejectedBall, onDragStart, onDragMove, motion, onDragEnd, onDragCancel,
  ]);
  return (
    <View
      ref={rootRef}
      style={styles.root}
      onLayout={handleRootLayout}
      collapsable={false}>
      <GameplayAssetWarmup key={assetRetry} onReady={setAssetsReady} onError={handleAssetError} />
      <SceneBackground
        gameplay
        tabletopY={
          bottleRects[0]
            ? bottleRects[0].y + bottleRects[0].height - 52 - rootPage.current.y
            : undefined
        }
      />
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom", "left", "right"]}>
        <GameplayScene
          key={`scene:${gameState.attemptId}`}
          level={level.id}
          coins={gameState.progress.coins}
          progress={completedTubes.length / gameState.tubes.length}
          stars={gameState.earnedStars}
          actions={sceneActions}
          feedback={<GameplayBanner key={gameState.attemptId} events={gameState.effects} milestone={!!level.milestone} fallback={getMoveGoalText(level, gameState) ?? ""} />}
          onPause={onPause}
          onCoins={onCoins}
          board={sceneBoard}
          tray={sceneTray}
        />
        <TutorialCoach
          key={gameState.attemptId}
          message={getTutorialMessage(level, gameState)}
        />
        {!assetsReady && <View style={styles.overlay}><View style={styles.overlayCard}>
          <Text style={styles.overlayCopy}>{assetError ? 'The scene could not load.' : 'Setting the table…'}</Text>
          {assetError && <Button label="RETRY" onPress={() => {setAssetError(false);setAssetRetry(value => value + 1);}} />}
        </View></View>}
        {activeHint && (
          <Pressable
            onPress={() => setActiveHint(null)}
            style={[
              styles.hintPanel,
              { position: "absolute", top: "24%", left: 24, right: 24 },
            ]}>
            <Text style={styles.hintPanelText}>{activeHint}</Text>
          </Pressable>
        )}
        {coinInfo && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayTitle}>
                {gameState.progress.coins} coins
              </Text>
              <Text style={styles.overlayCopy}>
                {gameState.coinsEarned} coins earned this attempt. Added to your
                balance after completion.
              </Text>
              <Button label="KEEP PLAYING" onPress={() => setCoinInfo(false)} />
            </View>
          </View>
        )}

        {gameState.status === "lost" && !showResultOverlay && <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor:"rgba(25,15,9,.18)"}]} />}
        {gameOver && won && !reducedMotion && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Confetti />
          </View>
        )}

        {paused && !gameOver && (
          <View style={styles.overlay}>
            <WoodPanel style={styles.pausePanel}>
              <View style={styles.pauseIconCircle}>
                <GameIcon name="pause" color={WOODLAND.gold} size={22} />
              </View>
              <Text style={styles.pauseEyebrow}>GAME ON HOLD</Text>
              <Text style={styles.pauseTitle}>Take a breath</Text>
              <Text style={styles.pauseCopy}>
                Your bottles are waiting for the perfect balance.
              </Text>
              <WoodButton
                label="Resume Play"
                accessibilityLabel="RESUME PLAY"
                variant="primary"
                onPress={() => { fire("lightTap"); setPaused(false); }}
                style={styles.pauseButton}
              />
              <WoodButton
                label="Restart Level"
                accessibilityLabel="RESTART LEVEL"
                variant="secondary"
                onPress={() => {
                  fire("lightTap");
                  handleResetGame();
                  setPaused(false);
                }}
                style={styles.pauseButton}
              />
              <Text style={styles.pauseStats}>
                {`${gameState.moves} moves`} · {gameState.score} points
                {gameState.combo >= 2
                  ? ` · ${comboLabel(gameState.combo)}`
                  : ""}
              </Text>
              <View style={styles.pauseRow}>
                <WoodButton
                  label="Level Map"
                  accessibilityLabel="LEVEL MAP"
                  variant="secondary"
                  onPress={() => { fire("lightTap"); router.push("/level-select"); }}
                  style={styles.pauseRowButton}
                />
                <WoodButton
                  label="Home"
                  accessibilityLabel="HOME"
                  variant="secondary"
                  onPress={() => { fire("lightTap"); router.push("/"); }}
                  style={styles.pauseRowButton}
                />
              </View>
            </WoodPanel>
          </View>
        )}

        {gameState.storageError && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayCopy}>{gameState.storageError}</Text>
              <Button
                label="RETRY SAVE"
                onPress={() => {
                  void gameState.retrySave();
                }}
              />
            </View>
          </View>
        )}
        {showResultOverlay && !gameState.storageError && (
          <FailureScreen reviveAvailable={reviveAvailable} reviveCost={reviveCost}
            coins={gameState.progress.coins} busy={gameState.utilityBusy || rewardedAd.status === 'showing'}
            rewardedAd={rewardedAd.supported ? { status: rewardedAd.status, notice: adNotice, onPress: onRewardedRevive } : undefined}
            onRevive={onRevive} onRestart={handleResetGame} onLevels={() => router.push('/level-select')} />
        )}
      </SafeAreaView>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.screenFlash, screenFlashStyle]}
      />

      {draggingBall && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            testID="dragged-weight"
            {...RASTERIZE_PROPS}
            style={[
              {
                position: "absolute",
                zIndex: 100,
                shadowColor: "#1f1004",
                shadowOffset: { width: 3, height: 12 },
                shadowOpacity: 0.55,
                shadowRadius: 10,
              },
              draggedStyle,
            ]}>
            <Ball
              color={draggingBall.ball.color}
              weight={draggingBall.ball.weight}
              size={dragRenderSize.current}
            />
          </Animated.View>
        </View>
      )}

      {rejectedBall && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ReturningWeight
            size={dragRenderSize.current}
            ball={rejectedBall.ball}
            from={rejectedBall.from}
            to={rejectedBall.to}
            at={rejectedBall.at}
          />
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
    backgroundColor: "transparent",
  },
  screenFlash: { backgroundColor: "#fff8eb" },
  disabled: {
    opacity: 0.45,
  },
  hintPanel: {
    backgroundColor: "rgba(52, 33, 21, 0.94)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(246, 210, 160, 0.4)",
    shadowColor: "#332014",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  hintPanelText: {
    color: "#fff0d8",
    fontSize: 12,
    lineHeight: 17,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(30, 21, 14, 0.82)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayCard: {
    backgroundColor: "#38281d",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    padding: 18,
    alignItems: "center",
    gap: 10,
    minWidth: 260,
    maxWidth: 340,
    overflow: "hidden",
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
    alignSelf: "stretch",
    marginHorizontal: -18,
    marginTop: -18,
    paddingVertical: 14,
    alignItems: "center",
    gap: 5,
  },
  overlayBannerText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: FONTS.displayBold,
    letterSpacing: 0.5,
  },
  overlaySubtitle: {
    color: THEME.muted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 19,
  },
  overlayScore: {
    color: UI_COLORS.text,
    fontSize: 25,
    fontFamily: FONTS.displaySemiBold,
  },
  overlayActionButton: {
    marginTop: 8,
    alignSelf: "stretch",
    minWidth: 180,
  },
  overlayIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayEyebrow: {
    color: "#fcd34d",
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: FONTS.displayBold,
  },
  overlayCopy: {
    color: THEME.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: -3,
    marginBottom: 5,
  },
  pausePanel: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 22,
    minWidth: 270,
    maxWidth: 340,
  },
  pauseIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 220, 130, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 224, 148, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseEyebrow: {
    color: WOODLAND.gold,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: GAME_FONT,
    fontWeight: "700",
  },
  pauseTitle: {
    color: WOODLAND.cream,
    fontSize: 25,
    fontFamily: GAME_FONT,
    fontWeight: "800",
    marginBottom: 2,
    textShadowColor: "#291305",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  pauseCopy: {
    color: WOODLAND.muted,
    fontFamily: GAME_FONT,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginTop: -3,
    marginBottom: 5,
  },
  pauseButton: {
    alignSelf: "stretch",
  },
  pauseStats: {
    color: WOODLAND.muted,
    fontFamily: GAME_FONT,
    fontSize: 12,
    textAlign: "center",
  },
  pauseRow: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
  },
  pauseRowButton: {
    flex: 1,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  scorePanel: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 9,
    marginTop: 5,
  },
  scoreLabel: {
    color: "#86a4b5",
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: FONTS.displaySemiBold,
  },
  pauseIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 15,
    borderRadius: 2,
  },
  bulbIcon: {
    alignItems: "center",
    justifyContent: "flex-end",
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
    borderRightColor: "transparent",
    borderTopColor: "transparent",
    borderRadius: 12,
    transform: [{ rotate: "25deg" }],
  },
  undoArrow: {
    position: "absolute",
    left: -3,
    top: 1,
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "35deg" }],
  },
  gridIcon: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightWidth: 0,
  },
  symbolIcon: {
    fontFamily: FONTS.displayBold,
    lineHeight: 24,
  },
  lockIcon: {
    alignItems: "center",
    justifyContent: "flex-end",
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
