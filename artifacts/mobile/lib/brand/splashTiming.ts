/**
 * Timing for the AnyChess launch intro (application start only).
 * Values are milliseconds from intro start.
 *
 * Native Android splash (expo-splash-screen) → this branded intro → Home.
 * Keep the navy background continuous across that handoff.
 */
export const ANYCHESS_NAVY = '#0B1728';
export const ANYCHESS_TAGLINE = 'JOUER. APPRENDRE. VISUALISER.';

/** Logo mark fade + subtle scale. */
export const LOGO_FADE_DELAY_MS = 100;
export const LOGO_FADE_DURATION_MS = 500;
export const LOGO_SCALE_FROM = 0.94;

/** "AnyChess" wordmark. */
export const WORDMARK_FADE_DELAY_MS = 400;
export const WORDMARK_FADE_DURATION_MS = 500;

/** Tagline. */
export const TAGLINE_FADE_DELAY_MS = 700;
export const TAGLINE_FADE_DURATION_MS = 500;

/**
 * Minimum time the intro should run before starting the exit fade.
 * Composition is fully visible after ~1.2s; hold briefly, then leave around 2.0–2.5s.
 */
export const MIN_INTRO_MS = 2100;

/** Crossfade out to Home. */
export const EXIT_FADE_DURATION_MS = 400;

/**
 * If app init finishes after MIN_INTRO_MS, keep the full composition
 * visible this long before fading (avoid an abrupt cut).
 */
export const LATE_READY_HOLD_MS = 280;

/**
 * Delay before starting the exit fade, once `appReady` is true.
 * Overlaps init with the intro: does not add wait when init was already slow.
 */
export function msUntilExitFadeStart(args: {
  introStartedAtMs: number;
  appReadyAtMs: number | null;
  nowMs: number;
}): number | null {
  const { introStartedAtMs, appReadyAtMs, nowMs } = args;
  if (appReadyAtMs == null) return null;

  const elapsed = Math.max(0, nowMs - introStartedAtMs);
  if (elapsed < MIN_INTRO_MS) {
    return MIN_INTRO_MS - elapsed;
  }

  const sinceReady = Math.max(0, nowMs - appReadyAtMs);
  if (sinceReady < LATE_READY_HOLD_MS) {
    return LATE_READY_HOLD_MS - sinceReady;
  }

  return 0;
}

export function totalIntroBudgetMs(): number {
  return MIN_INTRO_MS + EXIT_FADE_DURATION_MS;
}
