import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';

export interface CountUpTextProps extends TextProps {
  value: number;
  duration?: number;
}

/**
 * Animates a number counting up from 0 to `value` on mount (or whenever
 * `value` changes), easing out near the end. Used for the level-complete
 * score reveal so the final tally feels earned rather than just appearing.
 */
export default function CountUpText({ value, duration = 900, style, ...rest }: CountUpTextProps) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    let raf: number;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <Text style={style} {...rest}>
      {display.toLocaleString()}
    </Text>
  );
}
