/**
 * Compatibility shim — challenge-level timeouts were removed.
 * Prefer TimedChallengeTimer from lib/timedChallenge.
 */
import { TimedChallengeTimer } from '../timedChallenge/TimedChallengeTimer.ts';

/** @deprecated Use TimedChallengeTimer. Kept for existing imports/tests. */
export class MoveNamingTimer extends TimedChallengeTimer {
  private challengeHandle: ReturnType<typeof setTimeout> | null = null;

  /** @deprecated Per-question timeouts are no longer used by Nommer le coup. */
  startChallenge(seconds: number, onTimeout: () => void): void {
    this.clearChallenge();
    this.challengeHandle = setTimeout(() => {
      this.challengeHandle = null;
      onTimeout();
    }, seconds * 1000);
  }

  clearChallenge(): void {
    if (this.challengeHandle !== null) clearTimeout(this.challengeHandle);
    this.challengeHandle = null;
  }

  override dispose(): void {
    this.clearChallenge();
    super.dispose();
  }
}
