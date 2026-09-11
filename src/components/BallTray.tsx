import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { Ball as BallType } from '@/types/game';
import { TRAY_WOOD_TONES } from '@/utils/constants';
import Ball from './Ball';

const DRAG_THRESHOLD_PX = 6;

export interface BallTrayProps {
  balls: BallType[];
  selectedBallId: string | null;
  /** Id of the ball currently being dragged, if any — its tray slot dims while a floating copy follows the finger. */
  draggingBallId: string | null;
  /** A ball's slot was pressed or picked up; (pageX, pageY) is the touch's starting screen position. */
  onDragStart: (ball: BallType, pageX: number, pageY: number) => void;
  /** The finger moved while dragging a ball; (pageX, pageY) is its current screen position. */
  onDragMove: (pageX: number, pageY: number) => void;
  /** The touch ended; `moved` is false for a plain tap (no drag past the threshold). */
  onDragEnd: (pageX: number, pageY: number, moved: boolean) => void;
}

/**
 * Recessed wood tray holding every ball not yet placed into a bottle.
 * Dragging a ball onto a bottle drops it there directly; a plain tap (no
 * movement) just selects it, so tapping a ball then tapping a bottle still
 * works as an alternative to dragging.
 */
export default function BallTray({ balls, selectedBallId, draggingBallId, onDragStart, onDragMove, onDragEnd }: BallTrayProps) {
  return (
    <LinearGradient colors={TRAY_WOOD_TONES.gradient} style={styles.tray}>
      <View style={styles.recess}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          style={styles.ballScroll}
        >
        {balls.map((ball) => (
          <DraggableBallSlot
            key={ball.id}
            ball={ball}
            isSelected={ball.id === selectedBallId}
            isDragging={ball.id === draggingBallId}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        ))}
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

function DraggableBallSlot({
  ball,
  isSelected,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  ball: BallType;
  isSelected: boolean;
  isDragging: boolean;
  onDragStart: BallTrayProps['onDragStart'];
  onDragMove: BallTrayProps['onDragMove'];
  onDragEnd: BallTrayProps['onDragEnd'];
}) {
  const pan = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onStart((e) => {
      runOnJS(onDragStart)(ball, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      const moved = Math.hypot(e.translationX, e.translationY) > DRAG_THRESHOLD_PX;
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY, moved);
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Select ${ball.weight} kilogram ball`}
        style={[styles.slot, isDragging && styles.slotDragging]}
      >
        <View style={styles.slotShadow} />
        <Ball color={ball.color} weight={ball.weight} selected={isSelected} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tray: {
    alignSelf: 'center',
    width: '76%',
    minHeight: 86,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: TRAY_WOOD_TONES.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 8,
    elevation: 7,
  },
  recess: {
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(48, 27, 17, 0.72)',
    backgroundColor: 'rgba(45, 28, 19, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1f130d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 8,
    minWidth: '100%',
  },
  ballScroll: {
    width: '100%',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotDragging: {
    opacity: 0.25,
  },
  slotShadow: {
    position: 'absolute',
    bottom: -2,
    width: '70%',
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});
