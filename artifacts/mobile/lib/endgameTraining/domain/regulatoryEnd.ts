/**
 * Regulatory end detection for endgame training (chess.js authority).
 *
 * Optional attacker check: when the opponent lacks mating material (K / K+N / K+B),
 * treat as official draw success for defend-draw mode — even if the defender still
 * has pawns/material that could mate (chess.js isInsufficientMaterial would be false).
 */
import type { Chess } from 'chess.js';
import type { OfficialDrawReason } from './types.ts';
import { attackerLacksMatingMaterial } from './sideMatingMaterial.ts';

export type RegulatoryEnd =
  | { kind: 'checkmate'; winner: 'w' | 'b' }
  | { kind: 'draw'; reason: OfficialDrawReason };

export type EvaluateRegulatoryEndOptions = {
  /** Attacking side in defend-draw mode (opposite of defender). */
  attacker?: 'w' | 'b';
};

export function evaluateRegulatoryEnd(
  game: Chess,
  options?: EvaluateRegulatoryEndOptions,
): RegulatoryEnd | null {
  if (game.isCheckmate()) {
    const mated = game.turn();
    return { kind: 'checkmate', winner: mated === 'w' ? 'b' : 'w' };
  }
  if (game.isStalemate()) return { kind: 'draw', reason: 'stalemate' };
  if (game.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient' };
  if (game.isThreefoldRepetition()) return { kind: 'draw', reason: 'threefold' };
  if (game.isDrawByFiftyMoves()) return { kind: 'draw', reason: 'fifty' };

  if (
    options?.attacker &&
    attackerLacksMatingMaterial(game, options.attacker)
  ) {
    return { kind: 'draw', reason: 'position-defended' };
  }

  return null;
}
