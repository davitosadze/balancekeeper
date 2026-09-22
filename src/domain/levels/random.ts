/** FNV-1a over UTF-16 code units. Fixed 32-bit arithmetic on native and web. */
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}
/** Mulberry32; no ambient entropy or clock is used by campaign generation. */
export function seededRandom(seed: string) {
  let state = hashSeed(seed);
  const next = () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return { next, int, shuffle };
}
