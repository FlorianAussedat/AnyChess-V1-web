/**
 * Linear repertoire from one selected SAN path — used so a Review/Study
 * exercise cannot wander into another branch of the same PGN.
 */
import type { Move } from 'chess.js';
import { Chess } from 'chess.js';
import { exportGamePgn } from '../pgn/PgnExporter.ts';
import { buildRepertoire } from './repertoireTree.ts';
import type { ParsedRepertoire } from './types.ts';

export function repertoireFromSans(
  sans: readonly string[],
  startFen?: string,
): ParsedRepertoire {
  const chess = startFen ? new Chess(startFen) : new Chess();
  const moves: Move[] = [];
  for (const san of sans) {
    const played = chess.move(san) as Move | null;
    if (!played) break;
    moves.push(played);
  }
  const pgn = exportGamePgn({
    headers: { Event: 'AnyChess line', Result: '*' },
    moves,
  });
  return buildRepertoire(pgn);
}
