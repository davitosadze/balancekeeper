import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';

export interface CountUpTextProps extends TextProps {
  value: number;
  duration?: number;
  from?: number;
  delay?: number;
}

/**
 * Animates a number counting from `from` (default 0) to `value` on mount (or whenever
 * `value` changes), easing out near the end. Used for the level-complete
 * score reveal so the final tally feels earned rather than just appearing.
 */
export default function CountUpText({ value, duration = 900, from = 0, delay = 0, style, ...rest }: CountUpTextProps) {
  const reduced = useReducedMotionPreference();
  const [display, setDisplay] = useState(from);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if(reduced || duration <= 0) { setDisplay(value); return; }
    startRef.current = null;
    setDisplay(from);
    let raf: number;
    let lastUpdate = -Infinity;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      if(t-lastUpdate >= 33 || p === 1) { setDisplay(Math.round(from + eased * (value - from))); lastUpdate = t; }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [value, duration, from, delay, reduced]);

  return (
    <Text style={style} {...rest}>
      {(reduced ? value : display).toLocaleString()}
    </Text>
  );
}
