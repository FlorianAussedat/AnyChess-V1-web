/**
 * Platform-independent session controller for Nommer le coup.
 */
import { Chess } from 'chess.js';
import { parseChessVoice } from '../voice/parseChessVoice.ts';
import { emptyMoveNamingScore, scoreMoveNamingAttempt } from './MoveNamingScorer.ts';
import { MoveNamingTimer } from './MoveNamingTimer.ts';
import type { MoveNamingChallenge, MoveNamingOutcome, MoveNamingScore } from './types.ts';

export type MoveNamingPhase = 'idle' | 'countdown' | 'playing' | 'completed';

export const COUNTDOWN_LABELS = ['3', '2', '1', 'GO'] as const;
export const COUNTDOWN_STEP_MS = 1000;
export const SESSION_SECONDS = 60;

export type MoveNamingSnapshot = {
  phase: MoveNamingPhase;
  responseSeconds: number;
  voiceEnabled: boolean;
  challenge: MoveNamingChallenge | null;
  score: MoveNamingScore;
  remainingSeconds: number;
  countdownLabel: string | null;
  previousRecord: number;
  isNewRecord: boolean;
};

export type MoveNamingScheduler = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout> | null) => void;
};

const defaultScheduler: MoveNamingScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => {
    if (handle !== null) clearTimeout(handle);
  },
};

export function isMoveNamingRecordBeat(score: number, previousRecord: number): boolean {
  return score > previousRecord;
}

export class MoveNamingSession {
  private phase: MoveNamingPhase = 'idle';
  private responseSeconds = 4;
  private voiceEnabled = true;
  private challenge: MoveNamingChallenge | null = null;
  private score: MoveNamingScore = emptyMoveNamingScore();
  private countdownLabel: string | null = null;
  private countdownIndex = 0;
  private countdownHandle: ReturnType<typeof setTimeout> | null = null;
  private previousRecord = 0;
  private isNewRecord = false;
  private sessionSeconds = SESSION_SECONDS;
  private readonly timer: MoveNamingTimer;
  private readonly scheduler: MoveNamingScheduler;
  private readonly pickChallenge: (previousId?: string) => MoveNamingChallenge | null;

  constructor(options: {
    timer?: MoveNamingTimer;
    scheduler?: MoveNamingScheduler;
    pickChallenge: (previousId?: string) => MoveNamingChallenge | null;
  }) {
    this.timer = options.timer ?? new MoveNamingTimer();
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.pickChallenge = options.pickChallenge;
  }

  configure(options: {
    responseSeconds?: number;
    voiceEnabled?: boolean;
    previousRecord?: number;
    sessionSeconds?: number;
  }): MoveNamingSnapshot {
    if (options.responseSeconds !== undefined) {
      this.responseSeconds = options.responseSeconds;
    }
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
    const previousId = this.challenge.puzzleId;
    this.timer.clearChallenge();
    this.score = scoreMoveNamingAttempt(this.score, outcome);
    this.loadNextChallenge(previousId);
    return this.snapshot();
  }

  replay(): MoveNamingSnapshot {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.score = emptyMoveNamingScore();
    this.countdownLabel = null;
    this.isNewRecord = false;
    this.sessionSeconds = SESSION_SECONDS;
    return this.snapshot();
  }

  returnToIdle(): MoveNamingSnapshot {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.countdownLabel = null;
    return this.snapshot();
  }

  markRecordSaved(savedScore: number): MoveNamingSnapshot {
    this.isNewRecord = isMoveNamingRecordBeat(savedScore, this.previousRecord);
    this.previousRecord = Math.max(this.previousRecord, savedScore);
    return this.snapshot();
  }

  snapshot(): MoveNamingSnapshot {
    return {
      phase: this.phase,
      responseSeconds: this.responseSeconds,
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
    };
  }

  dispose(): void {
    this.disposeTimers();
    this.phase = 'idle';
    this.challenge = null;
    this.countdownLabel = null;
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
    const next = this.pickChallenge(previousId);
    this.challenge = next;
    if (this.phase === 'playing' && next) {
      this.timer.startChallenge(this.responseSeconds, () => {
        this.submitOutcome('timeout');
      });
    }
  }

  private endSession(): void {
    this.timer.clearChallenge();
    this.challenge = null;
    this.phase = 'completed';
    this.isNewRecord = isMoveNamingRecordBeat(this.score.score, this.previousRecord);
  }

  private disposeTimers(): void {
    this.scheduler.clearTimeout(this.countdownHandle);
    this.countdownHandle = null;
    this.timer.dispose();
  }
}
