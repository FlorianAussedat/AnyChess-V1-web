/**
 * In-memory session for a single-line opening exercise.
 * Never written to the repertoire store.
 *
 * Lifecycle: set when launching “Jouer / Continuer cette ligne” or a Review
 * pick, then released by `leaveEphemeralOpeningExercise` as soon as the user
 * leaves `/openings/play` or `/openings/continue`. A stale session must never
 * leak into a later Review.
 */
export type EphemeralOpeningSession = {
  fileId: string;
  folderId: string;
  pathSans: string[];
  pathId: string;
  sourcePgn: string;
  displayName: string;
  side: 'white' | 'black';
  origin: 'review' | 'study';
};

let current: EphemeralOpeningSession | null = null;

export function setEphemeralOpeningSession(
  session: EphemeralOpeningSession | null,
): void {
  current = session;
}

export function getEphemeralOpeningSession(): EphemeralOpeningSession | null {
  return current;
}

/** Central cleanup — the only way a parked training line is discarded. */
export function leaveEphemeralOpeningExercise(): void {
  current = null;
}

/** @deprecated Use leaveEphemeralOpeningExercise */
export function clearEphemeralOpeningSession(): void {
  leaveEphemeralOpeningExercise();
}

export function isOpeningExercisePath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';
  return path === '/openings/play' || path === '/openings/continue';
}

/**
 * Drop the parked line when leaving an exercise route (back, replace, hub,
 * analyser, learning, another mode, unmount). Staying on play/continue keeps it
 * so “ligne suivante” can replace the session in place.
 */
export function releaseEphemeralOpeningSessionIfLeaving(
  previousPathname: string | null | undefined,
  nextPathname: string | null | undefined,
): boolean {
  if (!isOpeningExercisePath(previousPathname)) return false;
  if (isOpeningExercisePath(nextPathname)) return false;
  leaveEphemeralOpeningExercise();
  return true;
}

/**
 * Read the parked line only when it matches this exercise. A mismatch (e.g. a
 * leftover “Jouer cette ligne” while launching Review) is discarded so the
 * persistent active pool is used instead.
 */
export function ephemeralSessionForOrigin(
  origin: 'review' | 'study' | string | string[] | undefined,
): EphemeralOpeningSession | null {
  const eph = current;
  if (!eph) return null;
  const requested = Array.isArray(origin) ? origin[0] : origin;
  if (requested !== 'review' && requested !== 'study') {
    leaveEphemeralOpeningExercise();
    return null;
  }
  if (eph.origin !== requested) {
    leaveEphemeralOpeningExercise();
    return null;
  }
  return eph;
}
