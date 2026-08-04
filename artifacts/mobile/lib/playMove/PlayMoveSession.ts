/**
 * Jouer le coup — 60-second session controller (inverse of Nommer le coup).
 */
import {
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP_MS,
  SESSION_SECONDS,
  TimedChallengeTimer,
  defaultTimedChallengeScheduler,
  isRecordBeat,
  type TimedChallengePhase,
  type TimedChallengeScheduler,
} from '../timedChallenge/index.ts';
import { emptyPlayMoveScore, scorePlayMoveAttempt } from './PlayMoveScorer.ts';
import { isCorrectPlayMove } from './PlayMoveChallenge.ts';
import type { PlayMoveChallenge, PlayMoveOutcome, PlayMoveScore } from './types.ts';

export type PlayMovePhase = TimedChallengePhase;

export type PlayMoveSnapshot = {
  phase: PlayMovePhase;
  challenge: PlayMoveChallenge | null;
  score: PlayMoveScore;
  remainingSeconds: number;
  countdownLabel: string | null;
  previousRecord: number;
  isNewRecord: boolean;
  lastFeedback: 'wrong' | null;
  /** Bumped when board must reset to the challenge position after a wrong try. */
  boardResetToken: number;
};

export class PlayMoveSession {
  private phase: PlayMovePhase = 'idle';
  private challenge: PlayMoveChallenge | null = null;
  private score: PlayMoveScore = emptyPlayMoveScore();
  private countdownLabel: string | null = null;
  private countdownIndex = 0;
  private countdownHandle: ReturnType<typeof setTimeout> | null = null;
  private previousRecord = 0;
  private isNewRecord = false;
  private lastFeedback: 'wrong' | null = null;
  private boardResetToken = 0;
  private sessionSeconds = SESSION_SECONDS;
  private readonly timer: TimedChallengeTimer;
  private readonly scheduler: TimedChallengeScheduler;
  private readonly pickChallenge: (previousId?: string) => PlayMoveChallenge | null;

  constructor(options: {
    timer?: TimedChallengeTimer;
    scheduler?: TimedChallengeScheduler;
    pickChallenge: (previousId?: string) => PlayMoveChallenge | null;
  }) {
    this.timer = options.timer ?? new TimedChallengeTimer();
    this.scheduler = options.scheduler ?? defaultTimedChallengeScheduler;
    this.pickChallenge = options.pickChallenge;
  }

  configure(options: {
    previousRecord?: number;
    sessionSeconds?: number;
  }): PlayMoveSnapshot {
    if (options.previousRecord !== undefined) {
      this.previousRecord = options.previousRecord;
    }
    if (options.sessionSeconds !== undefined) {
      this.sessionSeconds = options.sessionSeconds;
    }
    return this.snapshot();
  }

  startCountdown(): PlayMoveSnapshot {
    if (this.phase !== 'idle') return this.snapshot();
    this.disposeTimers();
    this.phase = 'countdown';
    this.score = emptyPlayMoveScore();
    this.challenge = null;
    this.isNewRecord = false;
    this.lastFeedback = null;
    this.boardResetToken = 0;
    this.countdownIndex = 0;
    this.countdownLabel = COUNTDOWN_LABELS[0] ?? null;
    this.scheduleCountdownAdvance();
    return this.snapshot();
  }

  /** Attempt a board move against the active challenge. */
  attemptBoardMove(from: string, to: string, promotion?: string | null): PlayMoveSnapshot {
    if (this.phase !== 'playing' || !this.challenge) return this.snapshot();
    const ok = isCorrectPlayMove(this.challenge, from, to, promotion);
    return this.submitOutcome(ok ? 'correct' : 'wrong');
  }

  submitOutcome(outcome: PlayMoveOutcome): PlayMoveSnapshot {
    if (this.phase !== 'playing' || !this.challenge) return this.snapshot();
    this.score = scorePlayMoveAttempt(this.score, outcome);

    if (outcome === 'correct') {
      this.lastFeedback = null;
      const previousId = this.challenge.puzzleId;
      this.loadNextChallenge(previousId);
      return this.snapshot();
    }

    this.lastFeedback = 'wrong';
    this.boardResetToken += 1;
    return this.snapshot();
  }

  replay(): PlayMoveSnapshot {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.score = emptyPlayMoveScore();
    this.countdownLabel = null;
    this.isNewRecord = false;
    this.lastFeedback = null;
    this.boardResetToken = 0;
    this.sessionSeconds = SESSION_SECONDS;
    return this.snapshot();
  }

  returnToIdle(): PlayMoveSnapshot {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.countdownLabel = null;
    this.lastFeedback = null;
    return this.snapshot();
  }

  snapshot(): PlayMoveSnapshot {
    return {
      phase: this.phase,
      challenge: this.challenge,
      score: { ...this.score },
      remainingSeconds:
        this.phase === 'playing' || this.phase === 'completed'
          ? Math.max(0, this.sessionSeconds - Math.floor(this.timer.elapsedSeconds()))
          : this.sessionSeconds,
      countdownLabel: this.countdownLabel,
      previousRecord: this.previousRecord,
      isNewRecord: this.isNewRecord,
      lastFeedback: this.lastFeedback,
      boardResetToken: this.boardResetToken,
    };
  }

  dispose(): void {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.countdownLabel = null;
    this.lastFeedback = null;
  }

  private scheduleCountdownAdvance(): void {
    this.scheduler.clearTimeout(this.countdownHandle);
    this.countdownHandle = this.scheduler.setTimeout(() => {
      this.countdownHandle = null;
      this.countdownIndex += 1;
      if (this.countdownIndex >= COUNTDOWN_LABELS.length) {
        this.beginPlaying();
        return;
      }
      this.countdownLabel = COUNTDOWN_LABELS[this.countdownIndex] ?? null;
      this.scheduleCountdownAdvance();
    }, COUNTDOWN_STEP_MS);
  }

  private beginPlaying(): void {
    this.countdownLabel = null;
    this.phase = 'playing';
    this.timer.startSession(this.sessionSeconds, () => this.endSession());
    this.loadNextChallenge();
  }

  private loadNextChallenge(previousId?: string): void {
    this.challenge = this.pickChallenge(previousId);
  }

  private endSession(): void {
    this.challenge = null;
    this.phase = 'completed';
    this.lastFeedback = null;
    this.isNewRecord = isRecordBeat(this.score.score, this.previousRecord);
  }

  private disposeTimers(): void {
    this.scheduler.clearTimeout(this.countdownHandle);
    this.countdownHandle = null;
    this.timer.dispose();
  }
}

export { COUNTDOWN_LABELS, COUNTDOWN_STEP_MS, SESSION_SECONDS };
