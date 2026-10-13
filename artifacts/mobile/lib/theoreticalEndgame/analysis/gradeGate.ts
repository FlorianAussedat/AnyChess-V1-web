/**
 * One engine, two jobs. A new game claims the transport and invalidates the
 * grade that was using it, so a late bestmove cannot be stored on the wrong attempt.
 */
let gradeGeneration = 0;
let playGeneration = 0;

export function claimEngineForPlay(stop?: () => void | Promise<void>): number {
  playGeneration += 1;
  gradeGeneration += 1;
  try {
    void stop?.();
  } catch {
    /* the next search still owns the transport */
  }
  return playGeneration;
}

export function releaseEngineFromPlay(token: number): void {
  if (token === playGeneration) playGeneration = 0;
}

/** Null while a game owns the engine. */
export function takeGradeToken(): number | null {
  if (playGeneration !== 0) return null;
  gradeGeneration += 1;
  return gradeGeneration;
}

export function gradeTokenCurrent(token: number): boolean {
  return playGeneration === 0 && token === gradeGeneration;
}

/** Test isolation. */
export function resetGradeGate(): void {
  gradeGeneration = 0;
  playGeneration = 0;
}
