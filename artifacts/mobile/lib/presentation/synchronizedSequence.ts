/**
 * Orchestrates synchronized move presentation:
 * board move → speak → wait real TTS end → pause (dictation pace) → next.
 *
 * SpeechService owns utterance completion; this module owns sequencing.
 */
import {
  DEFAULT_DICTATION_PACE,
  dictationPaceToGapMs,
  type DictationPace,
} from '../preferences/dictationPace.ts';

export type SynchronizedMove = {
  /** SAN or display token for callbacks. */
  san: string;
  /** Text already prepared for TTS (e.g. sanToVerbal). Empty = skip speak. */
  verbal?: string;
};

export type SynchronizedSequenceOptions = {
  moves: SynchronizedMove[];
  /** When true, speak each move's verbal (if non-empty). */
  speak: boolean;
  /**
   * Called before speaking each move. Apply the board move here.
   * Index is 0-based within `moves`.
   */
  onBoardMove?: (move: SynchronizedMove, index: number) => void | Promise<void>;
  /** Global dictation pace (pause after speech / visual step). */
  pace?: DictationPace;
  /** Override gap ms (tests). Defaults from pace. */
  gapMs?: number;
  /**
   * Speak one utterance and resolve when TTS finishes (or immediately if muted).
   * Must honour cancel via generation / reject on stop.
   */
  speakAndWait: (text: string) => Promise<void>;
  /** Optional delay helper (injectable for tests). */
  delay?: (ms: number, isCancelled: () => boolean) => Promise<void>;
  ownerId?: string;
};

export type SynchronizedSequenceHandle = {
  cancel: () => void;
  readonly done: Promise<void>;
  readonly isRunning: boolean;
};

function defaultDelay(ms: number, isCancelled: () => boolean): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const check = setInterval(() => {
      if (isCancelled()) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 40);
    setTimeout(() => clearInterval(check), ms + 20);
  });
}

/**
 * Play a synchronized sequence. Cancel stops further steps; in-flight speak
 * should be stopped by the caller via speechService.cancel().
 */
export function playSynchronizedSequence(
  options: SynchronizedSequenceOptions,
): SynchronizedSequenceHandle {
  let cancelled = false;
  let running = true;
  const pace = options.pace ?? DEFAULT_DICTATION_PACE;
  const gapMs =
    options.gapMs ?? dictationPaceToGapMs(pace);
  const delayFn = options.delay ?? defaultDelay;

  const isCancelled = () => cancelled;

  const done = (async () => {
    try {
      for (let i = 0; i < options.moves.length; i++) {
        if (cancelled) return;
        const move = options.moves[i];

        // 1) Board first (timeline owned by speech when speaking).
        if (options.onBoardMove) {
          await options.onBoardMove(move, i);
        }
        if (cancelled) return;

        // 2) Speak and wait for real TTS end.
        if (options.speak) {
          const verbal = (move.verbal ?? '').trim();
          if (verbal) {
            try {
              await options.speakAndWait(verbal);
            } catch {
              return; // cancelled / stopped
            }
          }
        }
        if (cancelled) return;

        // 3) Pace gap before next move (not after last).
        if (i < options.moves.length - 1) {
          await delayFn(gapMs, isCancelled);
        }
      }
    } finally {
      running = false;
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      running = false;
    },
    done,
    get isRunning() {
      return running && !cancelled;
    },
  };
}
