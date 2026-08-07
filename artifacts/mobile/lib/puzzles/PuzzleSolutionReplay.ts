/**
 * Timed solution replay — fixed 2000 ms between half-moves.
 * First move fires immediately. cancel() clears pending timers.
 */
import type { PuzzleReplayMove } from './types.ts';

export const PUZZLE_REPLAY_DELAY_MS = 2000;

export interface PuzzleSolutionReplayCallbacks {
  onStart?: () => void;
  onMove: (move: PuzzleReplayMove, index: number, total: number) => void;
  onComplete: () => void;
}

export class PuzzleSolutionReplay {
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
      this.timer = null;
    }
    this.running = false;
  }

  /**
   * Replay `moves` with a fixed delay BETWEEN half-moves.
   * First move starts immediately.
   */
  start(moves: PuzzleReplayMove[], callbacks: PuzzleSolutionReplayCallbacks): void {
    this.cancel();
    if (moves.length === 0) {
      callbacks.onComplete();
      return;
    }

    const myGen = this.generation;
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
        this.running = false;
        this.timer = null;
        callbacks.onComplete();
        return;
      }
      this.timer = setTimeout(step, PUZZLE_REPLAY_DELAY_MS);
    };

    step();
  }
}
