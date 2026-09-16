/**
 * Platform-independent session controller for Nommer le coup (60-second mode).
 *
 * Rules:
 * - Global 60s timer; no per-question timeout
 * - Wrong / unrecognized answers keep the same challenge
 * - Correct answers +1 and load the next challenge
 */
import { Chess } from 'chess.js';
import { parseChessVoice } from '../voice/parseChessVoice.ts';
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
import type { BoardPerspective } from './boardPerspective.ts';
import type { MoveNamingChallenge, MoveNamingOutcome, MoveNamingScore } from './types.ts';
import { emptyMoveNamingScore, scoreMoveNamingAttempt } from './MoveNamingScorer.ts';

export type MoveNamingPhase = TimedChallengePhase;

export { COUNTDOWN_LABELS, COUNTDOWN_STEP_MS, SESSION_SECONDS };

export type MoveNamingSnapshot = {
  phase: MoveNamingPhase;
  /** @deprecated Per-question response window removed; always unused (0). */
  responseSeconds: number;
  voiceEnabled: boolean;
  challenge: MoveNamingChallenge | null;
  score: MoveNamingScore;
  remainingSeconds: number;
  countdownLabel: string | null;
  previousRecord: number;
  isNewRecord: boolean;
  /** Brief feedback after an attempt (correct is non-blocking / short-lived in UI). */
  lastFeedback: 'correct' | 'wrong' | 'recognition-failure' | null;
};

export type MoveNamingScheduler = TimedChallengeScheduler;

/** @deprecated Prefer isRecordBeat from timedChallenge. */
export function isMoveNamingRecordBeat(score: number, previousRecord: number): boolean {
  return isRecordBeat(score, previousRecord);
}

export class MoveNamingSession {
  private phase: MoveNamingPhase = 'idle';
  private voiceEnabled = true;
  private challenge: MoveNamingChallenge | null = null;
  private score: MoveNamingScore = emptyMoveNamingScore();
  private countdownLabel: string | null = null;
  private countdownIndex = 0;
  private countdownHandle: ReturnType<typeof setTimeout> | null = null;
  private previousRecord = 0;
  private isNewRecord = false;
  private lastFeedback: 'correct' | 'wrong' | 'recognition-failure' | null = null;
  private sessionSeconds = SESSION_SECONDS;
  private readonly timer: TimedChallengeTimer;
  private readonly scheduler: MoveNamingScheduler;
  private readonly pickChallenge: (
    previousId?: string,
    previousPerspective?: BoardPerspective,
  ) => MoveNamingChallenge | null;

  constructor(options: {
    timer?: TimedChallengeTimer;
    scheduler?: MoveNamingScheduler;
    pickChallenge: (
      previousId?: string,
      previousPerspective?: BoardPerspective,
    ) => MoveNamingChallenge | null;
  }) {
    this.timer = options.timer ?? new TimedChallengeTimer();
    this.scheduler = options.scheduler ?? defaultTimedChallengeScheduler;
    this.pickChallenge = options.pickChallenge;
  }

  configure(options: {
    voiceEnabled?: boolean;
    previousRecord?: number;
    sessionSeconds?: number;
    /** @deprecated Ignored — per-question timeout removed. */
    responseSeconds?: number;
  }): MoveNamingSnapshot {
    if (options.voiceEnabled !== undefined) {
      this.voiceEnabled = options.voiceEnabled;
    }
    if (options.previousRecord !== undefined) {
      this.previousRecord = options.previousRecord;
    }
    if (options.sessionSeconds !== undefined) {
      this.sessionSeconds = options.sessionSeconds;
    }
    return this.snapshot();
  }

  startCountdown(): MoveNamingSnapshot {
    if (this.phase !== 'idle') return this.snapshot();
    this.disposeTimers();
    this.phase = 'countdown';
    this.score = emptyMoveNamingScore();
    this.challenge = null;
    this.isNewRecord = false;
    this.lastFeedback = null;
    this.countdownIndex = 0;
    this.countdownLabel = COUNTDOWN_LABELS[0] ?? null;
    this.scheduleCountdownAdvance();
    return this.snapshot();
  }

  answer(raw: string): MoveNamingSnapshot {
    if (this.phase !== 'playing' || !this.challenge) return this.snapshot();
    const game = new Chess(this.challenge.initialFen);
    const result = parseChessVoice(raw, game);
    if (result.type === 'unrecognized' || result.type === 'ambiguous') {
      return this.submitOutcome('recognition-failure');
    }
    if (result.type === 'move') {
      const ok =
        result.move.from === this.challenge.setupMove.from &&
        result.move.to === this.challenge.setupMove.to;
      return this.submitOutcome(ok ? 'correct' : 'wrong');
    }
    return this.submitOutcome('wrong');
  }

  submitOutcome(outcome: MoveNamingOutcome): MoveNamingSnapshot {
    if (this.phase !== 'playing' || !this.challenge) return this.snapshot();

    if (outcome === 'timeout') {
      // Deprecated path — ignore if somehow called; never advance.
      return this.snapshot();
    }

    this.score = scoreMoveNamingAttempt(this.score, outcome);

    if (outcome === 'correct') {
      this.lastFeedback = 'correct';
      const previousId = this.challenge.puzzleId;
      this.loadNextChallenge(previousId);
      return this.snapshot();
    }

    this.lastFeedback = outcome === 'recognition-failure' ? 'recognition-failure' : 'wrong';
    return this.snapshot();
  }

  replay(): MoveNamingSnapshot {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.score = emptyMoveNamingScore();
    this.countdownLabel = null;
    this.isNewRecord = false;
    this.lastFeedback = null;
    this.sessionSeconds = SESSION_SECONDS;
    return this.snapshot();
  }

  returnToIdle(): MoveNamingSnapshot {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.countdownLabel = null;
    this.lastFeedback = null;
    return this.snapshot();
  }

  markRecordSaved(savedScore: number): MoveNamingSnapshot {
    this.isNewRecord = isRecordBeat(savedScore, this.previousRecord);
    this.previousRecord = Math.max(this.previousRecord, savedScore);
    return this.snapshot();
  }

  snapshot(): MoveNamingSnapshot {
    return {
      phase: this.phase,
      responseSeconds: 0,
      voiceEnabled: this.voiceEnabled,
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
    const previousPerspective = this.challenge?.boardPerspective;
    this.challenge = this.pickChallenge(previousId, previousPerspective);
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
