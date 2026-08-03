/**
 * Shared timed board-replay controller for Blind Sequence observation + review.
 * One active replay at a time; cancel() clears pending timers cleanly.
 */
import type { BlindSequenceMove } from './types';

export interface BoardReplayCallbacks {
  /** Called once before the first move (board should already be reset). */
  onStart?: () => void;
  /** Apply move `index` (0-based) and refresh UI. */
  onMove: (move: BlindSequenceMove, index: number, total: number) => void;
  /** Called after the last move has been shown (final position kept). */
  onComplete: () => void;
}

export class BoardReplayController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private generation = 0;

  get isRunning(): boolean {
    return this.running;
  }

  cancel(): void {
    this.generation += 1;
    if (this.timer != null) {
      clearTimeout(this.timer);
    }
    this.timer = null;
    this.running = false;
  }

  /**
   * Replay `moves` with `delayMs` BETWEEN moves.
   * First move starts immediately; subsequent moves wait `delayMs`.
   */
  start(
    moves: BlindSequenceMove[],
    delayMs: number,
    callbacks: BoardReplayCallbacks,
  ): void {
    this.cancel();
    if (moves.length === 0) {
      callbacks.onComplete();
      return;
    }

    const myGen = this.generation;
    const delay = Math.max(0, delayMs);
    this.running = true;
    callbacks.onStart?.();

    let i = 0;
    const step = () => {
      if (myGen !== this.generation) return;
      if (i >= moves.length) {
        this.running = false;
        this.timer = null;
        callbacks.onComplete();
        return;
      }
      callbacks.onMove(moves[i], i, moves.length);
      i += 1;
      if (i >= moves.length) {
        // Last move shown — complete without an extra delay.
        this.running = false;
        this.timer = null;
        callbacks.onComplete();
        return;
      }
      this.timer = setTimeout(step, delay);
    };

    // First move immediately.
    step();
  }
}
