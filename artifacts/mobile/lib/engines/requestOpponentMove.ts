/**
 * One identified opponent search. Shared by Classic (and tests) so a late
 * reply from position A can never be applied to position B, and a terminal
 * FEN is not reported as an engine crash.
 */
import type { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../engine.ts';

export type OpponentMoveOutcome =
  | { kind: 'move'; move: Move; requestId: number }
  | { kind: 'terminal'; requestId: number }
  | { kind: 'cancelled'; requestId: number }
  | { kind: 'error'; requestId: number; reason: string };

export function logOpponentMoveDebug(info: Record<string, unknown>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[opponent-move]', info);
  }
}

function isTerminal(game: Chess): boolean {
  if (game.isGameOver()) return true;
  return game.moves().length === 0;
}

async function searchOnce(
  engine: ChessEngine,
  game: Chess,
  fen: string,
  requestId: number,
  isCurrent: (id: number) => boolean,
): Promise<Move | null | 'threw'> {
  try {
    await engine.init?.();
    if (!isCurrent(requestId) || game.fen() !== fen) return null;
    if (isTerminal(game)) return null;
    return await engine.pickMove(game);
  } catch (err) {
    logOpponentMoveDebug({
      reason: 'exception',
      fen,
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'threw';
  }
}

export async function requestOpponentMove(input: {
  engine: ChessEngine | null;
  game: Chess;
  requestId: number;
  isCurrent: (id: number) => boolean;
  mode: string;
  /** Default true — one recoverable retry, never a loop. */
  retryOnce?: boolean;
}): Promise<OpponentMoveOutcome> {
  const { game, requestId, isCurrent, mode } = input;
  if (!isCurrent(requestId)) return { kind: 'cancelled', requestId };
  if (isTerminal(game)) return { kind: 'terminal', requestId };

  const fen = game.fen();
  const engine = input.engine;
  if (!engine) {
    logOpponentMoveDebug({ mode, reason: 'no-engine', fen, requestId });
    return { kind: 'error', requestId, reason: 'no-engine' };
  }

  let selected = await searchOnce(engine, game, fen, requestId, isCurrent);
  if (!isCurrent(requestId) || game.fen() !== fen) {
    return { kind: 'cancelled', requestId };
  }
  if (isTerminal(game)) return { kind: 'terminal', requestId };

  if ((selected === null || selected === 'threw') && input.retryOnce !== false) {
    logOpponentMoveDebug({
      mode,
      reason: 'retry',
      fen,
      requestId,
      first: selected,
    });
    selected = await searchOnce(engine, game, fen, requestId, isCurrent);
    if (!isCurrent(requestId) || game.fen() !== fen) {
      return { kind: 'cancelled', requestId };
    }
    if (isTerminal(game)) return { kind: 'terminal', requestId };
  }

  if (!selected || selected === 'threw') {
    logOpponentMoveDebug({
      mode,
      reason: selected === 'threw' ? 'exception' : 'empty',
      fen,
      requestId,
    });
    return {
      kind: 'error',
      requestId,
      reason: selected === 'threw' ? 'exception' : 'empty',
    };
  }

  if (game.fen() !== fen || !isCurrent(requestId)) {
    return { kind: 'cancelled', requestId };
  }

  return { kind: 'move', move: selected, requestId };
}
