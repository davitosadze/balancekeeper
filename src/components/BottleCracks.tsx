import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import type { DamageStage, ImpactIntensity } from '@/types/game';

export interface BottleCracksProps {
  /** Current visual damage stage; nothing renders while 'pristine'. */
  stage: DamageStage;
  /** Stable seed (typically the tube index) so this bottle's crack layout doesn't reshuffle on re-render. */
  seed: number;
  /** Glass body dimensions the crack lines are laid out within. */
  width: number;
  height: number;
  /** Most recent impact on this bottle; a heavy/severe hit spawns a brief glass-particle burst. */
  impact?: { intensity: ImpactIntensity; at: number } | null;
}

const LINE_COUNT_BY_STAGE: Record<DamageStage, number> = {
  pristine: 0,
  hairline: 2,
  cracked: 4,
  critical: 6,
  broken: 6,
};

const SPARK_ANGLES = [0, 60, 120, 180, 240, 300];
const SPARK_DURATION_MS = 380;

/** Deterministic 0..1 pseudo-random generator so a bottle's crack layout is stable across re-renders. */
function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface CrackLine {
  top: number;
  left: number;
  length: number;
  rotation: number;
  thickness: number;
  opacity: number;
}

/**
 * Renders the bottle's glass damage as a handful of thin cracked-glass
 * lines, radiating in count and density from the current damage stage, plus
 * a subtle pulsing warning dot at the critical stage and a brief particle
 * burst on heavy impacts. Purely decorative and self-contained — Tube.tsx
 * just tells it the stage, a seed, and the last impact.
 */
export default function BottleCracks({ stage, seed, width, height, impact }: BottleCracksProps) {
  const lines = useMemo<CrackLine[]>(() => {
    const count = LINE_COUNT_BY_STAGE[stage];
    if (count === 0) return [];
    const rand = seededRandom(seed * 97 + count);
    const isSevere = stage === 'critical' || stage === 'broken';
    return Array.from({ length: count }).map(() => ({
      top: height * (0.12 + rand() * 0.68),
      left: width * (0.12 + rand() * 0.68),
      length: 16 + rand() * (isSevere ? 30 : 20),
      rotation: -70 + rand() * 140,
      thickness: isSevere ? 1.6 : stage === 'cracked' ? 1.3 : 1,
      opacity: isSevere ? 0.55 + rand() * 0.25 : 0.3 + rand() * 0.2,
    }));
  }, [stage, seed, width, height]);

  const showWarning = stage === 'critical';
  const warningPulse = useSharedValue(0);
  useEffect(() => {
    if (!showWarning) return;
    warningPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [showWarning, warningPulse]);
  const warningStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + warningPulse.value * 0.55,
  }));

  const sparkProgress = useSharedValue(0);
  const lastSparkAt = useRef<number | undefined>(undefined);
  const showSparks = impact && (impact.intensity === 'heavy' || impact.intensity === 'severe');
  useEffect(() => {
    if (!showSparks || !impact || impact.at === lastSparkAt.current) return;
    lastSparkAt.current = impact.at;
    sparkProgress.value = 0;
    sparkProgress.value = withTiming(1, {
      duration: SPARK_DURATION_MS,
      easing: Easing.out(Easing.quad),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impact?.at]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines.map((line, i) => (
        <View
          key={i}
          style={[
            styles.line,
            {
              top: line.top,
              left: line.left,
              width: line.length,
              height: line.thickness,
              opacity: line.opacity,
              transform: [{ rotate: `${line.rotation}deg` }],
            },
          ]}
        />
      ))}

      {showWarning && (
        <Animated.View style={[styles.warningDot, warningStyle]} />
      )}

      {showSparks &&
        SPARK_ANGLES.map((angle) => (
          <Spark key={angle} angle={angle} progress={sparkProgress} originX={width / 2} originY={height * 0.35} />
        ))}
    </View>
  );
}

function Spark({
  angle,
  progress,
  originX,
  originY,
}: {
  angle: number;
  progress: SharedValue<number>;
  originX: number;
  originY: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * 26;
  const dy = Math.sin(rad) * 26;

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: 1 - t,
      transform: [
        { translateX: originX + dx * t },
        { translateY: originY + dy * t },
        { scale: 1 - t * 0.4 },
      ],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.spark, style]} />;
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    backgroundColor: 'rgba(240, 250, 255, 0.85)',
  },
  warningDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 5,
  },
  spark: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: 4,
    marginLeft: -2,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: 'rgba(240, 250, 255, 0.95)',
  },
});
