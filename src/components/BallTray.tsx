import React, { useRef, useState, useEffect, memo } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, type SharedValue } from "react-native-reanimated";
import type { Ball as BallType } from "@/types/game";
import { trayLayout } from "./gameplay/layout";
import { LinearGradient } from "expo-linear-gradient";
import Ball from "./Ball";
import WoodTexture from "./gameplay/WoodTexture";
import { GAME_FONT } from "./gameplay/assets";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const DRAG_THRESHOLD_PX = 6;

export interface BallTrayProps {
  balls: BallType[];
  motion?: { x: SharedValue<number>; y: SharedValue<number>; originX: SharedValue<number>; originY: SharedValue<number>; hover: SharedValue<number>; rects: SharedValue<{x:number;y:number;width:number;height:number}[]> };
  onHover?: (index: number) => void;
  width?: number;
  selectedBallId: string | null;
  hintedBallId?: string;
  hintVersion?: number;
  /** Id of the ball currently being dragged, if any — its tray slot stays reserved while a floating copy follows the finger. */
  draggingBallId: string | null;
  /** A ball's slot was pressed or picked up; (pageX, pageY) is the touch's starting screen position. */
  onDragStart: (ball: BallType, pageX: number, pageY: number, origin?: { x: number; y: number; size?: number }) => void;
  /** The finger moved while dragging a ball; (pageX, pageY) is its current screen position. */
  onDragMove: (pageX: number, pageY: number) => void;
  /** The touch ended; `moved` is false for a plain tap (no drag past the threshold). */
  onDragEnd: (pageX: number, pageY: number, moved: boolean) => void;
  onDragCancel?: () => void;
}

/**
 * Tabletop row holding every ball not yet placed into a bottle.
 * Dragging a ball onto a bottle drops it there directly; a plain tap (no
 * movement) just selects it, so tapping a ball then tapping a bottle still
 * works as an alternative to dragging.
 */
function BallTray({
  motion, onHover,
  balls,
  width = 430,
  selectedBallId,
  hintedBallId,
  hintVersion,
  draggingBallId,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: BallTrayProps) {
  const scroll = useRef<ScrollView>(null);
  const reduced = useReducedMotionPreference();
  const [page, setPage] = useState(0);
  // Reserve the original inventory's sizing while objects are removed/returned.
  const sizingInventory = useRef(balls);
  if (balls.length > sizingInventory.current.length || balls.some(ball => !sizingInventory.current.some(item => item.id === ball.id))) sizingInventory.current = balls;
  const layout = trayLayout(sizingInventory.current.map(ball => ball.weight), width);
  // Keep the tray's footprint for the whole level. Removing its last page or
  // tallest weight must not move the bottles and recrop the room behind them.
  const ballAreaHeight = Math.max(layout.slotWidth, ...sizingInventory.current.map(ball => layout.size(ball.weight) * 1.14 * (ball.weight >= 15 ? 1.3 : 1))) + 5;
  const rowHeight = ballAreaHeight + 29;
  const footerHeight = layout.pageCount > 1 ? 22 : 12;
  const pages = Array.from({ length: Math.max(1, Math.ceil(balls.length / layout.pageSize)) }, (_, i) => balls.slice(i * layout.pageSize, (i + 1) * layout.pageSize));
  useEffect(() => {
    const nextPage = Math.min(page, pages.length - 1);
    if (page !== nextPage) setPage(nextPage);
    scroll.current?.scrollTo({ x: nextPage * width, animated: false });
  }, [pages.length, width]);
  useEffect(() => {
    if (!hintedBallId) return;
    const index = balls.findIndex(ball => ball.id === hintedBallId);
    if (index < 0) return;
    const hintPage = Math.floor(index / layout.pageSize);
    setPage(hintPage);
    scroll.current?.scrollTo({ x: hintPage * width, animated: !reduced });
  }, [hintedBallId, hintVersion, width, layout.pageSize, reduced]);
  const goToPage = (index: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, index));
    setPage(next);
    scroll.current?.scrollTo({ x: next * width, animated: !reduced });
  };
  return <LinearGradient testID="weight-tray" colors={['#ab7643', '#5d351a', '#321b0d']} locations={[0, .28, 1]} style={[styles.tray, { width }]}>
    <WoodTexture opacity={.24} />
    <View pointerEvents="none" style={styles.innerEdge} />
    <LinearGradient pointerEvents="none" colors={['#241207', '#482712', '#30190b']} style={[styles.recess, { height: rowHeight - 4 }]} />
    <View style={styles.heading}>
      <Text style={styles.headingText}>WEIGHTS</Text>
      <Text style={styles.help}>{balls.length === 0 ? 'All weights placed' : 'Drag a ball to a bottle'}</Text>
    </View>
    <ScrollView ref={scroll} horizontal pagingEnabled snapToInterval={width} decelerationRate="fast"
      scrollEnabled={!draggingBallId && pages.length > 1} showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
      style={{ width, height: rowHeight, flexGrow: 0 }} contentContainerStyle={{ alignItems: 'flex-end' }}>
      {pages.map((items, i) => <View key={i} style={[styles.row, { width, paddingHorizontal: layout.inset, gap: layout.gap, height: rowHeight }]}>
        {Array.from({ length: layout.pageSize }, (_, index) => {
          const ball = items[index];
          return ball ? <DraggableBallSlot key={ball.id} ball={ball} size={layout.size(ball.weight)} slotWidth={layout.slotWidth} ballAreaHeight={ballAreaHeight}
            isSelected={ball.id === selectedBallId || ball.id === hintedBallId} isDragging={ball.id === draggingBallId}
            motion={motion} onHover={onHover} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={onDragCancel} />
            : <View key={`empty-${index}`} pointerEvents="none" style={{ width: layout.slotWidth, height: ballAreaHeight + 24 }}><WeightHolder width={layout.slotWidth} ballAreaHeight={ballAreaHeight} /><Text style={styles.emptyMark}>·</Text></View>;
        })}
      </View>)}
    </ScrollView>
    <View style={[styles.footer, { height: footerHeight }]}>
      {pages.length > 1 && <>
        <Pressable disabled={!!draggingBallId || page === 0} accessibilityRole="button" accessibilityLabel="Previous weight page" onPress={() => goToPage(page - 1)} hitSlop={6} style={[styles.pageArrow, page === 0 && styles.unavailable]}><Text style={styles.arrowText}>‹</Text></Pressable>
        <View style={styles.pageDots}>{pages.map((_, i) => <Pressable key={i} disabled={!!draggingBallId} accessibilityRole="button" accessibilityLabel={`Weight page ${i + 1} of ${pages.length}`} accessibilityState={{ selected: i === page }} onPress={() => goToPage(i)} style={styles.pageDotTarget}><View style={[styles.pageDot, i === page && styles.activePageDot]} /></Pressable>)}</View>
        <Pressable disabled={!!draggingBallId || page === pages.length - 1} accessibilityRole="button" accessibilityLabel="Next weight page" onPress={() => goToPage(page + 1)} hitSlop={6} style={[styles.pageArrow, page === pages.length - 1 && styles.unavailable]}><Text style={styles.arrowText}>›</Text></Pressable>
      </>}
    </View>
  </LinearGradient>;
}

function WeightHolder({ width, ballAreaHeight, selected = false }: { width: number; ballAreaHeight: number; selected?: boolean }) {
  const diameter = width + (selected ? 3 : -2);
  return <View pointerEvents="none" style={[styles.holder, { width: diameter, height: diameter, top: ballAreaHeight - diameter + 4 }, selected && styles.holderSelected]}>
    <LinearGradient colors={selected ? ['#4e2e0d', '#674118', '#a37631'] : ['#1a0c05', '#30190b', '#55321a']} style={styles.holderInside} />
  </View>;
}

const DraggableBallSlot = memo(function DraggableBallSlot({
  motion, onHover,
  ball,
  size,
  slotWidth,
  ballAreaHeight,
  isSelected,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  motion?: BallTrayProps["motion"];
  onHover?: BallTrayProps["onHover"];
  ball: BallType;
  size: number;
  slotWidth: number;
  ballAreaHeight: number;
  isSelected: boolean;
  isDragging: boolean;
  onDragStart: BallTrayProps["onDragStart"];
  onDragMove: BallTrayProps["onDragMove"];
  onDragEnd: BallTrayProps["onDragEnd"];
  onDragCancel: BallTrayProps["onDragCancel"];
}) {
  const visualSize = size * (isSelected ? 1.14 : 1);
  const start = (x: number, y: number, localX: number, localY: number) => {
    // Gesture coordinates give the slot's current page origin even after paging.
    // Start synchronously: an async measure can finish after a quick tap ends,
    // leaving a floating weight behind after the release has already cleared it.
    onDragStart(ball, x, y, {
      x: x - localX + slotWidth / 2,
      y: y - localY + ballAreaHeight - visualSize * (ball.weight >= 15 ? 1.3 : 1) / 2,
      size: visualSize,
    });
  };
  const cancel = () => onDragCancel?.();
  const pan = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onStart((e) => {
      runOnJS(start)(e.absoluteX, e.absoluteY, e.x, e.y);
    })
    .onUpdate((e) => {
      if (motion) {
        motion.x.value = e.absoluteX - motion.originX.value;
        motion.y.value = e.absoluteY - motion.originY.value;
        const target = motion.rects.value.findIndex(rect => e.absoluteX >= rect.x && e.absoluteX <= rect.x + rect.width && e.absoluteY >= rect.y && e.absoluteY <= rect.y + rect.height);
        if(target !== motion.hover.value) {
          motion.hover.value = target;
          if(onHover) runOnJS(onHover)(target);
        }
      } else runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      const moved =
        Math.hypot(e.translationX, e.translationY) > DRAG_THRESHOLD_PX;
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY, moved);
    })
    .onFinalize((_e, success) => { if (!success) runOnJS(cancel)(); });

  return (
    <GestureDetector gesture={pan}>
      <View
        collapsable={false}
        testID={`weight-slot-${ball.id}`}
        accessible
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Select ${ball.weight} kilogram ball`}
        style={[styles.slot, { width: slotWidth, height: ballAreaHeight + 24 }]}>
        <WeightHolder width={slotWidth} ballAreaHeight={ballAreaHeight} selected={isSelected} />
        <View pointerEvents="none" style={[styles.ballArea, { height: ballAreaHeight }, isDragging && styles.slotDragging]}>
          <View style={styles.slotShadow} />
          <Ball color={ball.color} weight={ball.weight} size={visualSize} showLabel={false} />
        </View>
        <View pointerEvents="none" style={[styles.weightLabel, isSelected && styles.weightLabelSelected]}>
          <Text style={[styles.weightValue, isSelected && styles.selectedValue]}>{ball.weight}<Text style={styles.unit}> kg</Text></Text>
        </View>
      </View>
    </GestureDetector>
  );
});

export default memo(BallTray);

const styles = StyleSheet.create({
  tray: { borderRadius: 22, borderWidth: 2, borderColor: '#97683d', borderTopColor: '#d9a76c', borderBottomWidth: 5, borderBottomColor: '#241205', shadowColor: '#271407', shadowOpacity: .45, shadowRadius: 6, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  innerEdge: { position: 'absolute', left: 3, right: 3, top: 3, bottom: 3, borderWidth: 1, borderTopColor: 'rgba(255,217,155,.42)', borderColor: 'rgba(210,146,77,.22)', borderRadius: 17 },
  recess: { position: 'absolute', top: 40, left: 9, right: 9, borderRadius: 40, borderTopWidth: 3, borderTopColor: '#32190a', opacity: .87 },
  heading: { height: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, borderBottomWidth: 1, borderColor: 'rgba(186,126,62,.25)' },
  headingText: { fontFamily: GAME_FONT, fontSize: 9, fontWeight: '700', letterSpacing: 1.7, color: '#f3d6a7' },
  help: { fontFamily: GAME_FONT, fontSize: 10, color: '#d9bc95' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5 },
  slot: { alignItems: 'center' },
  ballArea: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  slotDragging: { opacity: 0 },
  holder: { position: 'absolute', alignSelf: 'center', borderRadius: 999, borderWidth: 1, borderTopColor: '#1f0e04', borderColor: '#69431f', borderBottomColor: '#a97740', backgroundColor: '#281408', padding: 4 },
  holderSelected: { borderWidth: 2, borderColor: '#ffd66c', borderTopColor: '#ffe798', shadowColor: '#ffb520', shadowOpacity: .95, shadowRadius: 11, shadowOffset: { width: 0, height: 0 } },
  holderInside: { flex: 1, borderRadius: 999, borderTopWidth: 2, borderTopColor: 'rgba(15,9,4,.4)' },
  slotShadow: { position: 'absolute', bottom: 0, width: '67%', height: 7, borderRadius: 999, backgroundColor: 'rgba(16,9,4,.55)', shadowColor: '#130b04', shadowOffset: { width: 0, height: 1 }, shadowOpacity: .5, shadowRadius: 3 },
  weightLabel: { minWidth: 38, height: 22, paddingHorizontal: 6, borderRadius: 7, marginTop: 2, backgroundColor: '#3b2719', borderWidth: 1, borderColor: '#967041', alignItems: 'center', justifyContent: 'center' },
  weightLabelSelected: { backgroundColor: '#654017', borderColor: '#ffd56b', shadowColor: '#ffba36', shadowOpacity: .8, shadowRadius: 7, shadowOffset: {width:0,height:0} },
  weightValue: { fontFamily: GAME_FONT, color: '#fff0cf', fontSize: 13, lineHeight: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  selectedValue: { color: '#ffe5a3' }, unit: { fontSize: 10, fontWeight: '500' },
  emptyMark: { position: 'absolute', bottom: 0, alignSelf: 'center', color: '#b78b57', fontSize: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pageArrow: { width: 34, height: 22, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 23, lineHeight: 23, color: '#efd4a0' },
  unavailable: { opacity: .25 },
  pageDots: { flexDirection: 'row', alignItems: 'center' }, pageDotTarget: { width: 25, height: 22, alignItems: 'center', justifyContent: 'center' },
  pageDot: { width: 5, height: 5, borderRadius: 4, backgroundColor: '#a58053' }, activePageDot: { width: 14, backgroundColor: '#ffdc8f' },
});
