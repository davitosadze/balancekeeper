import { recordRender } from '@/utils/performance';
import React, { useCallback, useEffect, useRef, useState, useMemo, memo } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import type {
  Tube as TubeType,
  GameplayEffect,
  InvalidPlacementEvent,
  FloatingPointEvent,
  BottleImpactEvent,
  BottleBreakEvent,
} from "@/types/game";
import Tube from "./Tube";
import { BOTTLE_ASPECT } from "./gameplay/layout";
import FloatingPoints from "./FloatingPoints";
import ParticleBurst from "./ParticleBurst";
import { EFFECT_TIMING } from "@/domain/bottleFeedback";
import { DURABILITY_CONFIG } from "@/utils/constants";

const SHAKE_DURATION_MS = 320;

/** Per-tube current/max durability; null = the durability system is disabled for that bottle. */
export type TubeDurabilityInfo = { current: number; max: number } | null;

/** A bottle's on-screen bounding box, in page coordinates (matching gesture pageX/pageY). */
export interface BottleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameBoardProps {
  tubes: TubeType[];
  effects?: GameplayEffect[];
  won?: boolean;
  width?: number;
  bottleHeight?: number;
  layoutHeight?: number;
  hoveredIndex?: number;
  hintIndex?: number;
  dragActive?: boolean;
  /** Tube indices that are valid drop targets for the currently selected tray ball. */
  validDropTargets: number[];
  completedTubes: number[];
  onTubePress: (index: number) => void;
  /** The most recent rejected placement attempt, used to drive the shake feedback. */
  invalidPlacement?: InvalidPlacementEvent | null;
  /** Called once the shake animation for invalidPlacement finishes. */
  onInvalidPlacementEnd?: () => void;
  /** Active floating point popups to render above the board. */
  floatingPoints?: FloatingPointEvent[];
  /** Called when a floating point popup finishes its animation. */
  onDismissFloatingPoint?: (id: string) => void;
  /** Tube indices currently locked behind the padlock gimmick. */
  lockedTubeIndices?: number[];
  /** Called whenever every bottle's on-screen rect has been measured (initial layout and on resize), for drag-and-drop hit-testing. */
  onBottleRects?: (rects: BottleRect[]) => void;
  /** Per-tube current/max durability, aligned by index; null entries are unbreakable (system disabled for that bottle). */
  tubeDurability?: TubeDurabilityInfo[];
  /** Tube indices that have shattered and can no longer receive balls. */
  brokenTubeIndices?: number[];
  /** The most recent ball-on-bottle impact, used to drive that bottle's shake/spark feedback. */
  lastImpact?: BottleImpactEvent | null;
  /** Called once the impact feedback for lastImpact finishes. */
  onImpactEnd?: () => void;
  /** The most recent bottle break, used to drive its shatter effect. */
  lastBreak?: BottleBreakEvent | null;
  /** Called once the shatter animation for lastBreak finishes. */
  onBreakEnd?: () => void;
}

/**
 * Renders the level’s bottle board in a horizontal row, delegating each bottle's
 * fill/lock visuals and tap handling to the Tube component, overlaying
 * floating point popups for scoring events, and measuring each bottle's
 * page-space bounding box so a dragged tray ball can be hit-tested against it.
 */
function GameBoard({
  tubes,
  effects = [], won = false,
  width = 390,
  bottleHeight = 240,
  layoutHeight,
  hoveredIndex = -1,
  hintIndex = -1,
  dragActive = false,
  validDropTargets,
  completedTubes,
  onTubePress,
  invalidPlacement,
  onInvalidPlacementEnd,
  floatingPoints = [],
  onDismissFloatingPoint,
  lockedTubeIndices = [],
  onBottleRects,
  tubeDurability = [],
  brokenTubeIndices = [],
  lastImpact,
  onImpactEnd,
  lastBreak,
  onBreakEnd,
}: GameBoardProps) {
  recordRender('board');
  const [boardWidth, setBoardWidth] = useState(0);
  const previousEffects = useRef<GameplayEffect[][]>([]);
  const bottleEffects = useMemo(() => {
    const next = tubes.map((_,index) => {
      const filtered = effects.filter(event => event.bottleIndex === index);
      const previous = previousEffects.current[index];
      return previous && previous.length === filtered.length && previous.every((event,i) => event === filtered[i]) ? previous : filtered;
    });
    previousEffects.current = next;
    return next;
  },[effects,tubes.length]);
  const boardRef = useRef<View>(null);
  const boardPage = useRef<{ x: number; y: number } | null>(null);
  const tubeLocalRects = useRef<
    Record<number, { x: number; y: number; width: number; height: number }>
  >({});

  const recomputeRects = useCallback(() => {
    if (!onBottleRects || !boardPage.current) return;
    const rects: BottleRect[] = [];
    for (let i = 0; i < tubes.length; i++) {
      const local = tubeLocalRects.current[i];
      if (!local) return; // wait until every bottle has reported layout
      rects.push({
        x: boardPage.current.x + local.x,
        y: boardPage.current.y + local.y,
        width: local.width,
        height: local.height,
      });
    }
    onBottleRects(rects);
  }, [onBottleRects, tubes.length]);

  useEffect(() => {
    // The proportional scene can move the board without changing its local
    // size. Re-measure page coordinates after its parent has finished layout.
    const frame = requestAnimationFrame(() => {
      boardRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        boardPage.current = { x: pageX, y: pageY };
        recomputeRects();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [width, bottleHeight, layoutHeight, recomputeRects]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setBoardWidth(event.nativeEvent.layout.width);
    boardRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      boardPage.current = { x: pageX, y: pageY };
      recomputeRects();
    });
  };

  const handleTubeLayout = (index: number, event: LayoutChangeEvent) => {
    tubeLocalRects.current[index] = event.nativeEvent.layout;
    recomputeRects();
  };

  const callbacks = useRef({onInvalidPlacementEnd, onImpactEnd, onBreakEnd});
  callbacks.current = {onInvalidPlacementEnd, onImpactEnd, onBreakEnd};
  useEffect(() => {
    if (!invalidPlacement) return;
    const timer = setTimeout(() => callbacks.current.onInvalidPlacementEnd?.(), SHAKE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [invalidPlacement]);
  useEffect(() => {
    if (!lastImpact) return;
    const timer = setTimeout(() => callbacks.current.onImpactEnd?.(), DURABILITY_CONFIG.impactFeedbackDurationMs);
    return () => clearTimeout(timer);
  }, [lastImpact]);
  useEffect(() => {
    if (!lastBreak) return;
    const timer = setTimeout(() => callbacks.current.onBreakEnd?.(), EFFECT_TIMING.break);
    return () => clearTimeout(timer);
  }, [lastBreak]);

  return (
    <View
      ref={boardRef}
      style={[styles.board, { width, justifyContent: "center", gap: Math.max(8, (width - tubes.length * bottleHeight * BOTTLE_ASPECT) / Math.max(1, tubes.length - 1)) }]}
      onLayout={handleLayout}
      collapsable={false}>
      {tubes.map((_, index) => (
        <View
          key={index}
          onLayout={(e) => handleTubeLayout(index, e)}
          collapsable={false}>
          <Tube
            effects={bottleEffects[index]}
            won={won}
            width={bottleHeight * BOTTLE_ASPECT}
            hovered={hoveredIndex === index}
            hinted={hintIndex === index}
            dragActive={dragActive}
            bottleHeight={bottleHeight}
            tube={tubes[index]}
            prerequisiteNumber={tubes.findIndex(tube => tube.id === tubes[index].unlockAfter) + 1}
            index={index}
            isSelected={validDropTargets.includes(index)}
            isComplete={completedTubes.includes(index)}
            onPress={onTubePress}
            shakeAt={
              invalidPlacement && invalidPlacement.tubeIndex === index
                ? invalidPlacement.at
                : undefined
            }
            locked={lockedTubeIndices.includes(index)}
            durability={tubeDurability[index]?.current ?? null}
            maxDurability={tubeDurability[index]?.max ?? null}
            broken={brokenTubeIndices.includes(index)}
            impact={
              lastImpact && lastImpact.tubeIndex === index
                ? lastImpact
                : undefined
            }
          />
        </View>
      ))}

      <ParticleBurst bottleCount={tubes.length} events={floatingPoints} boardWidth={boardWidth} />

      {onDismissFloatingPoint && (
        <FloatingPoints
          bottleCount={tubes.length}
          events={floatingPoints}
          boardWidth={boardWidth}
          onDismiss={onDismissFloatingPoint}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', alignSelf: 'center', overflow: 'visible' },
});

export default memo(GameBoard);
