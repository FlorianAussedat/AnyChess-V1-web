/**
 * Non-React playback scheduler for Lecteur de parties.
 *
 * Owns: ply cursor, play/pause, jump, interval timing, speech cancel tokens.
 * Does NOT assume playback only runs to game end (loop range hooks ready later).
 */
import { dictationPaceToGapMs, type DictationPace } from '../preferences/dictationPace.ts';
import { clampPly, nextPly, previousPly } from './playback.ts';
import type { ImportedChessGame } from './types.ts';

export type PlaybackSpeechPort = {
  speakSan: (san: string) => Promise<void>;
  cancel: (reason: string) => void;
};

export type PlaybackSchedulerListener = (state: GamePlaybackSchedulerState) => void;

export type GamePlaybackSchedulerState = {
  ply: number;
  isPlaying: boolean;
  ended: boolean;
  pace: DictationPace;
  /** Inclusive loop bounds for a future “repeat range” feature (null = full game). */
  loopFrom: number | null;
  loopTo: number | null;
};

export type GamePlaybackSchedulerOptions = {
  game: ImportedChessGame;
  speech: PlaybackSpeechPort;
  initialPace?: DictationPace;
  /** Injectable delay (tests). Defaults to setTimeout. */
  delay?: (ms: number, signal: { cancelled: () => boolean }) => Promise<void>;
  onStateChange?: PlaybackSchedulerListener;
};

function defaultDelay(ms: number, signal: { cancelled: () => boolean }): Promise<void> {
  return new Promise((resolve) => {
    if (signal.cancelled()) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      clearInterval(check);
      resolve();
    }, ms);
    const check = setInterval(() => {
      if (signal.cancelled()) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 40);
  });
}

export class GamePlaybackScheduler {
  private game: ImportedChessGame;
  private speech: PlaybackSpeechPort;
  private delayFn: NonNullable<GamePlaybackSchedulerOptions['delay']>;
  private onStateChange?: PlaybackSchedulerListener;

  private ply = 0;
  private isPlaying = false;
  private ended = false;
  private pace: DictationPace;
  private loopFrom: number | null = null;
  private loopTo: number | null = null;
  private runId = 0;
  private disposed = false;

  constructor(options: GamePlaybackSchedulerOptions) {
    this.game = options.game;
    this.speech = options.speech;
    this.pace = options.initialPace ?? 'medium';
    this.delayFn = options.delay ?? defaultDelay;
    this.onStateChange = options.onStateChange;
  }

  getState(): GamePlaybackSchedulerState {
    return {
      ply: this.ply,
      isPlaying: this.isPlaying,
      ended: this.ended,
      pace: this.pace,
      loopFrom: this.loopFrom,
      loopTo: this.loopTo,
    };
  }

  /** Exact FEN / history surface for future “Train from this position”. */
  getTrainingContext() {
    const ply = this.ply;
    const fen =
      ply <= 0
        ? this.game.initialFen
        : (this.game.moves[Math.min(ply, this.game.moves.length) - 1]?.fenAfter ??
          this.game.initialFen);
    const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    return {
      fen,
      sideToMove: sideToMove as 'w' | 'b',
      ply,
      sans: this.game.moves.slice(0, ply).map((m) => m.san),
      headers: this.game.headers,
      gameId: this.game.id,
    };
  }

  private emit() {
    this.onStateChange?.(this.getState());
  }

  private bumpRun(reason: string) {
    this.runId += 1;
    this.isPlaying = false;
    this.speech.cancel(reason);
  }

  setPace(pace: DictationPace) {
    this.pace = pace;
    this.emit();
  }

  /**
   * Optional future loop range (inclusive ply indices of positions after moves).
   * Null clears the loop (play through to end).
   */
  setLoopRange(from: number | null, to: number | null) {
    if (from == null || to == null) {
      this.loopFrom = null;
      this.loopTo = null;
    } else {
      this.loopFrom = clampPly(this.game, Math.min(from, to));
      this.loopTo = clampPly(this.game, Math.max(from, to));
    }
    this.emit();
  }

  jumpTo(target: number) {
    this.bumpRun('jump');
    this.ply = clampPly(this.game, target);
    this.ended = this.ply >= this.game.moves.length && this.game.moves.length > 0;
    this.emit();
  }

  goStart() {
    this.jumpTo(0);
  }

  goEnd() {
    this.jumpTo(this.game.moves.length);
  }

  goPrev() {
    this.bumpRun('prev');
    this.ply = previousPly(this.game, this.ply);
    this.ended = false;
    this.emit();
  }

  goNext() {
    this.bumpRun('next');
    this.ply = nextPly(this.game, this.ply);
    this.ended = this.ply >= this.game.moves.length;
    this.emit();
  }

  async repeatLast(): Promise<void> {
    if (this.ply < 1) return;
    const san = this.game.moves[this.ply - 1]?.san;
    if (!san) return;
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.bumpRun('repeat');
    this.emit();
    try {
      await this.speech.speakSan(san);
    } catch {
      // cancelled
    }
  }

  pause() {
    this.bumpRun('pause');
    this.emit();
  }

  dispose() {
    this.disposed = true;
    this.bumpRun('dispose');
    this.emit();
  }

  play() {
    if (this.disposed || this.game.moves.length === 0) return;
    if (this.ply >= this.game.moves.length) {
      this.ply = this.loopFrom ?? 0;
      this.ended = false;
    }
    this.ended = false;
    this.runId += 1;
    const runId = this.runId;
    this.isPlaying = true;
    this.emit();
    void this.runLoop(this.ply, runId);
  }

  private endBound(): number {
    if (this.loopTo != null) return this.loopTo;
    return this.game.moves.length;
  }

  private async runLoop(startPly: number, runId: number) {
    let cursor = startPly;
    while (!this.disposed && this.isPlaying && runId === this.runId) {
      const bound = this.endBound();
      if (cursor >= bound) {
        if (this.loopFrom != null && this.loopTo != null && this.loopFrom < this.loopTo) {
          cursor = this.loopFrom;
          this.ply = cursor;
          this.emit();
          continue;
        }
        this.isPlaying = false;
        this.ended = true;
        this.emit();
        return;
      }

      const next = cursor + 1;
      this.ply = next;
      this.emit();
      const san = this.game.moves[next - 1]!.san;
      try {
        await this.speech.speakSan(san);
      } catch {
        return;
      }
      if (this.disposed || !this.isPlaying || runId !== this.runId) return;

      const gap = dictationPaceToGapMs(this.pace);
      await this.delayFn(gap, {
        cancelled: () => this.disposed || !this.isPlaying || runId !== this.runId,
      });
      if (this.disposed || !this.isPlaying || runId !== this.runId) return;

      cursor = next;
      if (cursor >= this.endBound()) {
        if (this.loopFrom != null && this.loopTo != null && this.loopFrom < this.loopTo) {
          cursor = this.loopFrom;
          this.ply = cursor;
          this.emit();
          continue;
        }
        this.isPlaying = false;
        this.ended = true;
        this.emit();
        return;
      }
    }
  }
}
