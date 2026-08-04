type Clock = () => number;

function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Owns the global session timer for 60-second speed exercises.
 * No per-question timeout — questions stay until answered correctly.
 */
export class TimedChallengeTimer {
  private readonly now: Clock;
  private sessionHandle: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;

  constructor(now: Clock = monotonicNow) {
    this.now = now;
  }

  startSession(seconds: number, onEnd: () => void): void {
    this.clearSession();
    this.startedAt = this.now();
    this.sessionHandle = setTimeout(() => {
      this.sessionHandle = null;
      onEnd();
    }, seconds * 1000);
  }

  elapsedSeconds(): number {
    return this.startedAt ? Math.max(0, (this.now() - this.startedAt) / 1000) : 0;
  }

  clearSession(): void {
    if (this.sessionHandle !== null) clearTimeout(this.sessionHandle);
    this.sessionHandle = null;
  }

  dispose(): void {
    this.clearSession();
    this.startedAt = 0;
  }
}
