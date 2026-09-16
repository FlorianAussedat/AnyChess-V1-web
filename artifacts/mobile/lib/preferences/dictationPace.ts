/**
 * Global move-dictation pace — pause AFTER speech ends, before next move.
 * Single user-facing rhythm control (not TTS physical rate).
 */

export type DictationPace =
  | 'slow'
  | 'quiteSlow'
  | 'medium'
  | 'quiteFast'
  | 'fast';

export const DICTATION_PACES: readonly DictationPace[] = [
  'slow',
  'quiteSlow',
  'medium',
  'quiteFast',
  'fast',
] as const;

export const DEFAULT_DICTATION_PACE: DictationPace = 'medium';

/** Pause in ms after utterance ends, before the next move/speech. */
export const DICTATION_PACE_GAP_MS: Record<DictationPace, number> = {
  slow: 5000,
  quiteSlow: 4000,
  medium: 3000,
  quiteFast: 2000,
  fast: 1000,
};

export function isDictationPace(value: unknown): value is DictationPace {
  return (
    value === 'slow' ||
    value === 'quiteSlow' ||
    value === 'medium' ||
    value === 'quiteFast' ||
    value === 'fast'
  );
}

export function dictationPaceToGapMs(pace: DictationPace): number {
  return DICTATION_PACE_GAP_MS[pace] ?? DICTATION_PACE_GAP_MS.medium;
}

/** Comfortable fixed TTS rate — not exposed as a second user control. */
export const DEFAULT_TTS_RATE = 0.975; // voiceSpeedToRate(5)
