/**
 * Defensive-precision helpers + trivial-position rejection for Défends la nulle.
 */
import { Chess } from 'chess.js';
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import { defensivePrecision } from './wdl.ts';
import type { DefendDrawPosition } from './positions.ts';

/** Material that is a dead draw with no defensive content. */
export function isTrivialInsufficientMaterial(fen: string): boolean {
  const game = new Chess(fen);
  if (game.isInsufficientMaterial()) return true;
  const pieces = game
    .board()
    .flat()
    .filter(Boolean) as { type: string; color: 'w' | 'b' }[];
  if (pieces.length <= 2) return true; // K vs K
  const nonKings = pieces.filter((p) => p.type !== 'k');
  if (nonKings.length === 0) return true;
  // Lone minor vs lone king (KB/KN vs K)
  if (
    nonKings.length === 1 &&
    (nonKings[0]!.type === 'b' || nonKings[0]!.type === 'n')
  ) {
    return true;
  }
  // Two knights vs king — theoretically drawn / no forced mate, no tension for our mode
  if (
    nonKings.length === 2 &&
    nonKings.every((p) => p.type === 'n') &&
    nonKings[0]!.color === nonKings[1]!.color
  ) {
    return true;
  }
  return false;
}

/**
 * Reject positions where almost every move holds (no real exercise),
 * or where there is no drawing move at all.
 */
export function isDeadOrTrivialHold(
  drawingMoves: number,
  legalMoves: number,
): boolean {
  if (legalMoves <= 0) return true;
  if (drawingMoves <= 0) return true;
  const p = defensivePrecision(drawingMoves, legalMoves);
  // >85% of moves hold → too easy / "dead" for this mode
  if (p >= 0.85 && drawingMoves >= 6) return true;
  return false;
}

/** Expected precision band per difficulty (soft filter on curated pool). */
export function precisionFitsDifficulty(
  precision: number,
  drawingMoves: number,
  difficulty: AnyChessDifficultyId,
): boolean {
  switch (difficulty) {
    case 'debutant':
      // Pedagogical: several holds, not only-move
      return precision >= 0.25 && precision <= 0.75 && drawingMoves >= 3;
    case 'confirme':
      return precision >= 0.12 && precision <= 0.45 && drawingMoves >= 2;
    case 'expert':
      // Often ~1–3 holding moves
      return drawingMoves >= 1 && drawingMoves <= 4 && precision <= 0.28;
    case 'grandMaitre':
      // Extremely precise — often a single hold
      return drawingMoves >= 1 && drawingMoves <= 2 && precision <= 0.15;
  }
}

export function annotatePrecision(pos: DefendDrawPosition): number {
  return defensivePrecision(pos.drawingMoves, pos.legalMoves);
}

export function isEligibleDefendDrawPosition(pos: DefendDrawPosition): boolean {
  if (isTrivialInsufficientMaterial(pos.fen)) return false;
  if (isDeadOrTrivialHold(pos.drawingMoves, pos.legalMoves)) return false;
  if (pos.drawingMoves < 1 || pos.legalMoves < 1) return false;
  // Curated bank assigns difficulty manually; soft-check only rejects
  // obviously mismatched "only-move" pedagogy in débutant when legalMoves is large.
  if (pos.difficulty === 'debutant' && pos.drawingMoves === 1 && pos.legalMoves >= 12) {
    return false;
  }
  return true;
}
