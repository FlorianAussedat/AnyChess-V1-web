/**
 * Regulatory end detection for endgame training (chess.js authority).
 */
import type { Chess } from 'chess.js';
import type { OfficialDrawReason } from './types.ts';

export type RegulatoryEnd =
  | { kind: 'checkmate'; winner: 'w' | 'b' }
  | { kind: 'draw'; reason: OfficialDrawReason };

export function evaluateRegulatoryEnd(game: Chess): RegulatoryEnd | null {
  if (game.isCheckmate()) {
    const mated = game.turn();
    return { kind: 'checkmate', winner: mated === 'w' ? 'b' : 'w' };
  }
  if (game.isStalemate()) return { kind: 'draw', reason: 'stalemate' };
  if (game.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient' };
  if (game.isThreefoldRepetition()) return { kind: 'draw', reason: 'threefold' };
  if (game.isDrawByFiftyMoves()) return { kind: 'draw', reason: 'fifty' };
  return null;
}
