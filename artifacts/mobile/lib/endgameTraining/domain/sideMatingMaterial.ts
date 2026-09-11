/**
 * Attacker-side mating material — distinct from chess.js isInsufficientMaterial
 * (which requires that *neither* side can mate).
 *
 * Classic cases where the attacker cannot mate: lone King, King+Knight, King+Bishop.
 */
import type { Chess } from 'chess.js';

export type PieceSide = 'w' | 'b';

export type AttackerMaterialCounts = {
  knights: number;
  bishops: number;
  /** Pawns, rooks, queens — anything that can create forced mate with a king. */
  others: number;
};

/** Count non-king pieces for one side from the chess.js board. */
export function countSideMaterial(
  game: Chess,
  side: PieceSide,
): AttackerMaterialCounts {
  let knights = 0;
  let bishops = 0;
  let others = 0;
  for (const row of game.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== side || sq.type === 'k') continue;
      if (sq.type === 'n') knights += 1;
      else if (sq.type === 'b') bishops += 1;
      else others += 1;
    }
  }
  return { knights, bishops, others };
}

/**
 * True when `attacker` has only K, K+N, or K+B — cannot force (or typically create) mate.
 * Does NOT look at defender material.
 */
export function attackerLacksMatingMaterial(
  game: Chess,
  attacker: PieceSide,
): boolean {
  const { knights, bishops, others } = countSideMaterial(game, attacker);
  if (others > 0) return false;
  if (knights === 0 && bishops === 0) return true;
  if (knights === 1 && bishops === 0) return true;
  if (knights === 0 && bishops === 1) return true;
  return false;
}
