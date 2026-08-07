/**
 * Map Continue-la-ligne voice speed (1 slow … 10 fast) → expo-speech rate.
 */
export const VOICE_SPEED_MIN = 1;
export const VOICE_SPEED_MAX = 10;
export const DEFAULT_VOICE_SPEED = 5;

/** Speech rate roughly 0.60 (lent) → 1.35 (rapide). */
export function voiceSpeedToRate(level: number): number {
  const clamped = Math.max(
    VOICE_SPEED_MIN,
    Math.min(VOICE_SPEED_MAX, Math.round(level)),
  );
  const t = (clamped - VOICE_SPEED_MIN) / (VOICE_SPEED_MAX - VOICE_SPEED_MIN);
  return 0.6 + t * 0.75;
}
