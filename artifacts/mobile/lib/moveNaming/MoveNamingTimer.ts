type Clock = () => number;

function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Owns the two game timers and always clears prior handles before replacement. */
export class MoveNamingTimer {
  private readonly now: Clock;
  private challengeHandle: ReturnType<typeof setTimeout> | null = null;
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

  startChallenge(seconds: number, onTimeout: () => void): void {
    this.clearChallenge();
    this.challengeHandle = setTimeout(() => {
      this.challengeHandle = null;
      onTimeout();
    }, seconds * 1000);
  }

  elapsedSeconds(): number {
    return this.startedAt ? Math.max(0, (this.now() - this.startedAt) / 1000) : 0;
  }

  clearChallenge(): void {
    if (this.challengeHandle !== null) clearTimeout(this.challengeHandle);
    this.challengeHandle = null;
  }

  clearSession(): void {
    if (this.sessionHandle !== null) clearTimeout(this.sessionHandle);
    this.sessionHandle = null;
  }

  dispose(): void {
    this.clearChallenge();
    this.clearSession();
    this.startedAt = 0;
  }
}
