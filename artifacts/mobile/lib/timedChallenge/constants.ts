/** Shared 60-second speed-challenge session constants. */

export const COUNTDOWN_LABELS = ['3', '2', '1', 'GO'] as const;
export const COUNTDOWN_STEP_MS = 1000;
export const SESSION_SECONDS = 60;

export type TimedChallengePhase = 'idle' | 'countdown' | 'playing' | 'completed';
