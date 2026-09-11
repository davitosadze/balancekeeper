import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import type { Tube as TubeType, InvalidPlacementEvent, FloatingPointEvent } from '@/types/game';
import Tube from './Tube';
import FloatingPoints from './FloatingPoints';
import ParticleBurst from './ParticleBurst';

const SHAKE_DURATION_MS = 320;

/** A bottle's on-screen bounding box, in page coordinates (matching gesture pageX/pageY). */
export interface BottleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameBoardProps {
  tubes: TubeType[];
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
}

/**
 * Renders the 4-bottle board in a horizontal row, delegating each bottle's
 * fill/lock visuals and tap handling to the Tube component, overlaying
 * floating point popups for scoring events, and measuring each bottle's
 * page-space bounding box so a dragged tray ball can be hit-tested against it.
 */
export default function GameBoard({
  tubes,
  validDropTargets,
  completedTubes,
  onTubePress,
  invalidPlacement,
  onInvalidPlacementEnd,
  floatingPoints = [],
  onDismissFloatingPoint,
  lockedTubeIndices = [],
  onBottleRects,
}: GameBoardProps) {
  const [boardWidth, setBoardWidth] = useState(0);
  const boardRef = useRef<View>(null);
  const boardPage = useRef<{ x: number; y: number } | null>(null);
  const tubeLocalRects = useRef<Record<number, { x: number; y: number; width: number; height: number }>>({});

  const recomputeRects = useCallback(() => {
    if (!onBottleRects || !boardPage.current) return;
    const rects: BottleRect[] = [];
    for (let i = 0; i < tubes.length; i++) {
      const local = tubeLocalRects.current[i];
      if (!local) return; // wait until every bottle has reported layout
      rects.push({ x: boardPage.current.x + local.x, y: boardPage.current.y + local.y, width: local.width, height: local.height });
    }
    onBottleRects(rects);
  }, [onBottleRects, tubes.length]);

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

  useEffect(() => {
    if (!invalidPlacement || !onInvalidPlacementEnd) return;
    const timer = setTimeout(onInvalidPlacementEnd, SHAKE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [invalidPlacement, onInvalidPlacementEnd]);

  return (
    <View ref={boardRef} style={styles.board} onLayout={handleLayout} collapsable={false}>
      {tubes.map((_, index) => (
        <View key={index} onLayout={(e) => handleTubeLayout(index, e)} collapsable={false}>
          <Tube
            tubes={tubes}
            index={index}
            isSelected={validDropTargets.includes(index)}
            isComplete={completedTubes.includes(index)}
            onPress={onTubePress}
            shakeAt={invalidPlacement && invalidPlacement.tubeIndex === index ? invalidPlacement.at : undefined}
            locked={lockedTubeIndices.includes(index)}
          />
        </View>
      ))}

      <ParticleBurst events={floatingPoints} boardWidth={boardWidth} />

      {onDismissFloatingPoint && (
        <FloatingPoints events={floatingPoints} boardWidth={boardWidth} onDismiss={onDismissFloatingPoint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    height: 290,
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 0,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 2,
  },
});
