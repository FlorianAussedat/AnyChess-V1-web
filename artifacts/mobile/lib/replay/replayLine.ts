/**
 * Shared sequential line replay — platform-independent timer logic.
 *
 * Used by opening construction results, dictated-sequence results, and any
 * other mode that needs: reset → animate half-moves → stop on final position.
 *
 * Prevents overlapping replays via generation tokens; cancel() clears timers.
 */
import { Chess } from 'chess.js';

export const DEFAULT_REPLAY_INTERVAL_MS = 1000;

export type ReplayMove = {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
};

export type ReplayLineOptions = {
  initialFen?: string;
  moves: ReplayMove[] | string[];
  intervalMs?: number;
  onPosition?: (fen: string, moveIndex: number, san: string | null) => void;
  onMove?: (move: ReplayMove & { san: string }, index: number, total: number) => void;
  onComplete?: (finalFen: string) => void;
  onError?: (message: string) => void;
};

export type ReplayLineHandle = {
  cancel: () => void;
  readonly isRunning: boolean;
};

function asReplayMove(m: ReplayMove | string): ReplayMove {
  if (typeof m === 'string') {
    // SAN or UCI (e2e4 / e7e8q)
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(m)) {
      return {
        from: m.slice(0, 2).toLowerCase(),
        to: m.slice(2, 4).toLowerCase(),
        promotion: m[4]?.toLowerCase(),
      };
    }
    return { from: '', to: '', san: m };
  }
  return m;
}

/**
 * Start a cancellable line replay. First move fires immediately; subsequent
 * moves wait `intervalMs` (default 1000).
 */
export function replayLine(options: ReplayLineOptions): ReplayLineHandle {
  const intervalMs = options.intervalMs ?? DEFAULT_REPLAY_INTERVAL_MS;
  const moves = options.moves.map(asReplayMove);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let running = false;

  const cancel = () => {
    generation += 1;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    running = false;
  };

  if (moves.length === 0) {
    const game = new Chess(options.initialFen);
    options.onComplete?.(game.fen());
    return { cancel, get isRunning() { return false; } };
  }

  const myGen = ++generation;
  running = true;
  const game = new Chess(options.initialFen);
  options.onPosition?.(game.fen(), -1, null);

  let i = 0;
  const step = () => {
    if (myGen !== generation) return;
    if (i >= moves.length) {
      running = false;
      timer = null;
      options.onComplete?.(game.fen());
      return;
    }

    const raw = moves[i];
    let played;
    try {
      if (raw.san && !raw.from) {
        played = game.move(raw.san);
      } else {
        played = game.move({
          from: raw.from,
          to: raw.to,
          promotion: (raw.promotion as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
        });
      }
    } catch {
      played = null;
    }

    if (!played) {
      running = false;
      timer = null;
      options.onError?.(
        `Illegal replay move at index ${i}: ${raw.san ?? `${raw.from}${raw.to}`}`,
      );
      options.onComplete?.(game.fen());
      return;
    }

    const moveOut = {
      from: played.from,
      to: played.to,
      promotion: played.promotion,
      san: played.san,
    };
    options.onMove?.(moveOut, i, moves.length);
    options.onPosition?.(game.fen(), i, played.san);
    i += 1;

    if (i >= moves.length) {
      running = false;
      timer = null;
      options.onComplete?.(game.fen());
      return;
    }
    timer = setTimeout(step, intervalMs);
  };

  step();

  return {
    cancel,
    get isRunning() {
      return running;
    },
  };
}
