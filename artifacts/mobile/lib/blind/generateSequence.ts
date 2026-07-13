/**
 * Generate a coherent opening-like sequence with Stockfish.
 *
 * Starts from the initial position, asks the engine for a move at each step
 * (StockfishEngine already uses MultiPV variety), and avoids returning the
 * exact same UCI line as the previous exercise when possible.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '@/lib/engine';
import { verbalMove } from '@/lib/chessParser';
import { halfMoveCount, moveFromChessJs, type BlindSequenceMove } from './types';

export interface GenerateSequenceOptions {
  fullMoves: number;
  engine: ChessEngine;
  /** Previous sequence UCI string to avoid repeating when possible. */
  previousKey?: string | null;
  /** Extra regeneration attempts when the line matches `previousKey`. */
  maxRetries?: number;
}

export function sequenceKey(moves: BlindSequenceMove[]): string {
  return moves.map((m) => m.uci).join(' ');
}

export async function generateBlindSequence(
  options: GenerateSequenceOptions,
): Promise<BlindSequenceMove[]> {
  const target = halfMoveCount(options.fullMoves);
  const maxRetries = options.maxRetries ?? 3;

  let best: BlindSequenceMove[] = [];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const line = await generateOnce(options.engine, target);
    best = line;
    const key = sequenceKey(line);
    if (!options.previousKey || key !== options.previousKey) {
      return line;
    }
    // Same as last time — ask the engine again (MultiPV variety should differ).
  }
  return best;
}

async function generateOnce(
  engine: ChessEngine,
  halfMoves: number,
): Promise<BlindSequenceMove[]> {
  await engine.init?.();
  engine.newGame?.();

  const game = new Chess();
  const result: BlindSequenceMove[] = [];

  for (let i = 0; i < halfMoves; i++) {
    if (game.isGameOver()) break;

    let selected: Move | null = null;
    try {
      selected = (await engine.pickMove(game)) ?? null;
    } catch {
      selected = null;
    }

    if (!selected) {
      // Fallback: pick a random legal move so the exercise can still run.
      const legal = game.moves({ verbose: true }) as Move[];
      if (legal.length === 0) break;
      selected = legal[Math.floor(Math.random() * Math.min(legal.length, 4))];
    }

    const played = game.move({
      from: selected.from,
      to: selected.to,
      promotion: selected.promotion || 'q',
    }) as Move;

    result.push(moveFromChessJs(played, verbalMove(played)));
  }

  return result;
}
