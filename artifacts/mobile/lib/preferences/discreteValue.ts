/** Snap touch, keyboard and accessibility changes to the same valid step. */
export function snapDiscreteValue(
  value: number,
  min: number,
  max: number,
  step = 1,
): number {
  const spacing = Number.isFinite(step) && step > 0 ? step : 1;
  const lastStep = Math.max(0, Math.floor((max - min) / spacing));
  const index = Number.isFinite(value)
    ? Math.round((value - min) / spacing)
    : 0;
  return min + Math.max(0, Math.min(lastStep, index)) * spacing;
}
