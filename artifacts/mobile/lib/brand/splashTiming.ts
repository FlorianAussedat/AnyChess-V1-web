/**
 * Timing for the AnyChess launch intro (application start only).
 * Values are milliseconds from the moment the launch artwork has loaded.
 *
 * Native Android splash (expo-splash-screen) → this branded intro → Home.
 * Keep the navy background continuous across that handoff.
 */
export const ANYCHESS_NAVY = '#0B1728';
export const ANYCHESS_TAGLINE = 'JOUER. APPRENDRE. VISUALISER.';

/** Fade the supplied artwork as one image to keep the logo and tagline together. */
export const ENTER_FADE_DURATION_MS = 300;

/**
 * Minimum time the intro should run before starting the exit fade.
 * Starts only once the artwork has loaded, so it remains legible on slow devices.
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
 * Delay before starting the exit fade, once `appReady` is true and the
 * launch image has loaded (`introStartedAtMs`).
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
