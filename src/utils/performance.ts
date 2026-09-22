/** Opt-in development counters for browser/native profiling; never persisted. */
type Metrics = { renders: Record<string,number>; drops: number[] };
declare global { var __BALANCE_PERF__: Metrics | undefined; }
export function recordRender(name: string) {
  if(typeof __DEV__ !== 'undefined' && __DEV__ && globalThis.__BALANCE_PERF__) {
    const renders=globalThis.__BALANCE_PERF__.renders;renders[name]=(renders[name]??0)+1;
  }
}
export function beginDropMeasure() {
  return typeof __DEV__ !== 'undefined' && __DEV__ && globalThis.__BALANCE_PERF__ ? performance.now() : null;
}
export function endDropMeasure(start: number | null) {
  if(start!=null)globalThis.__BALANCE_PERF__?.drops.push(performance.now()-start);
}
