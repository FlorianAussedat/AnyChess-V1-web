/**
 * Blind-sequence speed levels 1→10 with progressive delay mapping.
 * Centralised so both submodes share one adjustable curve.
 */
export const BLIND_SPEED_MIN = 1;
export const BLIND_SPEED_MAX = 10;
export const DEFAULT_BLIND_SPEED = 5;

/**
 * Map speed level (1 slowest … 10 fastest) → inter-move delay in ms.
 * Progressive (not linear): low levels linger; high levels snap.
 */
export function blindSpeedToDelayMs(level: number): number {
  const clamped = Math.max(
    BLIND_SPEED_MIN,
    Math.min(BLIND_SPEED_MAX, Math.round(level)),
  );
  // 1 → 5500ms, 5 → ~2500ms, 10 → 700ms
  const t = (clamped - 1) / (BLIND_SPEED_MAX - 1);
  const slow = 5500;
  const fast = 700;
  // Ease-in so early steps drop faster at first, then flatten
  const eased = t * t;
  return Math.round(slow + (fast - slow) * eased);
}

export type BlindPerspective = 'white' | 'black' | 'random';

export function resolveBlindOrientation(
  perspective: BlindPerspective,
  rng: () => number = Math.random,
): 'w' | 'b' {
  if (perspective === 'white') return 'w';
  if (perspective === 'black') return 'b';
  return rng() < 0.5 ? 'w' : 'b';
}
