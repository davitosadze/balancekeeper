import { useCallback, useRef } from 'react';
/** Stable event identity with the current render's state, for memoized gesture children. */
export function useStableCallback<A extends unknown[], R>(callback: (...args: A) => R) {
  const latest = useRef(callback); latest.current = callback;
  return useCallback((...args: A) => latest.current(...args), []);
}
