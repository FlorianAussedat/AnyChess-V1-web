/**
 * Trivial / dead-position rejection for Défends la nulle starts.
 * Central helper — selection must never trust labels alone.
 */
import { Chess } from 'chess.js';
import type { DefendDrawPosition } from './positions.ts';

type Piece = { type: string; color: 'w' | 'b' };

function piecesOnBoard(fen: string): Piece[] {
  const game = new Chess(fen);
  return game
    .board()
    .flat()
    .filter(Boolean) as Piece[];
}

/** Material that is a dead draw with no defensive content. */
export function isTrivialInsufficientMaterial(fen: string): boolean {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return true;
  }
  if (game.isInsufficientMaterial()) return true;
  const pieces = piecesOnBoard(fen);
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
  // Two knights vs king — no forced mate, no tension for this mode
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
 * Opponent must have practical winning chances (else the "defence" is hollow).
 * Requires a pawn or a heavy piece / mating-capable force on the attacking side.
 */
export function opponentLacksPracticalPressure(
  fen: string,
  defenderColor: 'w' | 'b',
): boolean {
  const attacker = defenderColor === 'w' ? 'b' : 'w';
  const pieces = piecesOnBoard(fen).filter((p) => p.color === attacker);
  const types = pieces.map((p) => p.type);
  if (types.includes('p')) return false;
  if (types.includes('q') || types.includes('r')) return false;
  // Two bishops, or bishop+knight, can mate — still some content
  const bishops = types.filter((t) => t === 'b').length;
  const knights = types.filter((t) => t === 'n').length;
  if (bishops >= 2) return false;
  if (bishops >= 1 && knights >= 1) return false;
  // Lone king or lone minor (already insufficient) → no pressure
  return true;
}

/**
 * Dead opposite-bishop "holds" with no pawns left to create play.
 */
export function isDeadOppositeBishopHold(fen: string): boolean {
  const pieces = piecesOnBoard(fen);
  const nonKings = pieces.filter((p) => p.type !== 'k');
  if (nonKings.some((p) => p.type === 'p')) return false;
  const bishops = nonKings.filter((p) => p.type === 'b');
  if (bishops.length !== 2) return false;
  if (bishops[0]!.color === bishops[1]!.color) return false;
  // Only K+B vs K+B opposite — classic dead draw
  return nonKings.every((p) => p.type === 'b');
}

/**
 * Structural triviality (material / pressure) — ignores hold-ratio metadata.
 * Used before Syzygy counting; ratio is applied after certification counts exist.
 */
export function isStructurallyTrivialDefendDraw(
  fen: string,
  defenderColor: 'w' | 'b',
): boolean {
  if (isTrivialInsufficientMaterial(fen)) return true;
  if (opponentLacksPracticalPressure(fen, defenderColor)) return true;
  if (isDeadOppositeBishopHold(fen)) return true;
  return false;
}

/**
 * Central triviality gate for starts and selection.
 * Not based solely on piece count.
 */
export function isTrivialDefendDrawPosition(
  position: Pick<DefendDrawPosition, 'fen' | 'defenderColor' | 'drawingMoves' | 'legalMoves'>,
): boolean {
  if (isStructurallyTrivialDefendDraw(position.fen, position.defenderColor)) {
    return true;
  }
  if (position.legalMoves <= 0 || position.drawingMoves <= 0) return true;
  // Almost every move holds and there are many of them → no exercise
  if (
    position.drawingMoves >= 6 &&
    position.drawingMoves / position.legalMoves >= 0.85
  ) {
    return true;
  }
  return false;
}

/** @deprecated Prefer isTrivialDefendDrawPosition */
export function isDeadOrTrivialHold(
  drawingMoves: number,
  legalMoves: number,
): boolean {
  if (legalMoves <= 0) return true;
  if (drawingMoves <= 0) return true;
  if (drawingMoves >= 6 && drawingMoves / legalMoves >= 0.85) return true;
  return false;
}

export function isEligibleDefendDrawPosition(pos: DefendDrawPosition): boolean {
  if (pos.verifiedDraw !== true) return false;
  if (!pos.verification || pos.verification.result !== 'draw') return false;
  if (isTrivialDefendDrawPosition(pos)) return false;
  return true;
}

/** Soft band check kept for tooling; selection does not rely on labels alone. */
export function precisionFitsDifficulty(
  precision: number,
  drawingMoves: number,
  difficulty: import('../difficulty/anyChessDifficulty.ts').AnyChessDifficultyId,
): boolean {
  switch (difficulty) {
    case 'debutant':
      return precision >= 0.25 && precision <= 0.75 && drawingMoves >= 2;
    case 'confirme':
      return precision >= 0.12 && precision <= 0.5 && drawingMoves >= 2;
    case 'expert':
      return drawingMoves >= 1 && drawingMoves <= 4 && precision <= 0.35;
    case 'grandMaitre':
      return drawingMoves >= 1 && drawingMoves <= 2 && precision <= 0.2;
  }
}

export function annotatePrecision(pos: DefendDrawPosition): number {
  if (pos.legalMoves <= 0) return 0;
  return pos.drawingMoves / pos.legalMoves;
}
