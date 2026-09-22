/** Presentation-only geometry. No game capacities or inventory are changed. */
export const BOTTLE_CROP = { x: 240, y: 24, width: 544, height: 1488 };
export const BOTTLE_ASPECT = BOTTLE_CROP.width / BOTTLE_CROP.height;

const WEIGHT_SCALE = [[1, .72], [2, .82], [3, .88], [5, .96], [10, 1.06], [15, 1.14]];
export function displayWeightScale(weight: number) {
  for (let i = 1; i < WEIGHT_SCALE.length; i++) {
    const [end, endScale] = WEIGHT_SCALE[i];
    const [start, startScale] = WEIGHT_SCALE[i - 1];
    if (weight <= end) return startScale + Math.max(0, (weight - start) / (end - start)) * (endScale - startScale);
  }
  return 1.14;
}
export function trayLayout(weights: number[], width: number) {
  const inset = Math.min(24, Math.max(14, width * .045));
  const gap = Math.min(14, Math.max(8, width * .024));
  const preferred = Math.min(70, Math.max(62, width * .17));
  const maxScale = Math.max(1, ...weights.map(displayWeightScale));
  const cellWidth = (count: number) => Math.min(88, (width - inset * 2 - gap * (count - 1)) / count);
  const fitted = (count: number) => Math.min(preferred, (cellWidth(count) - 8) / maxScale);
  let pageSize = Math.max(1, Math.min(5, weights.length));
  // Five holders match the reference. The entire holder is the touch target,
  // so small/light spheres can vary in size while their hit areas stay accessible.
  while (pageSize > 1 && cellWidth(pageSize) < 44) pageSize--;
  const base = fitted(pageSize);
  return {
    inset, gap, pageSize, slotWidth: cellWidth(pageSize),
    pageCount: Math.max(1, Math.ceil(weights.length / pageSize)),
    size: (weight: number) => base * displayWeightScale(weight),
  };
}
