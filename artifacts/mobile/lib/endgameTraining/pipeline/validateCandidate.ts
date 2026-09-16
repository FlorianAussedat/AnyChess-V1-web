/**
 * Pure structural filters for endgame-training candidates (no engine).
 */
import { Chess } from 'chess.js';
import {
  countMaterial,
  isBareHeavySymmetry,
  materialSignature as defendMaterialSignature,
} from '../../defendDraw/materialSignature.ts';
import { isTrivialInsufficientMaterial } from '../../defendDraw/defensivePrecision.ts';
import { inferEndgameFamily } from './pool/family.ts';
import type { RejectionReason } from './types.ts';

export type EndgameFamilyKind =
  | 'pawn'
  | 'rook'
  | 'minor-piece'
  | 'rook-and-minor'
  | 'queen'
  | 'mixed';

export type StructuralValidation =
  | { ok: true; family: EndgameFamilyKind; materialSignature: string }
  | { ok: false; reason: RejectionReason };

export function materialSignature(fen: string): string {
  return defendMaterialSignature(fen);
}

function totalNonKingPieces(fen: string): number {
  const c = countMaterial(fen);
  return (
    c.Q + c.q + c.R + c.r + c.B + c.b + c.N + c.n + c.P + c.p
  );
}

function isKingsOnly(fen: string): boolean {
  return totalNonKingPieces(fen) === 0;
}

/**
 * Infer family from piece counts (spec taxonomy).
 */
export function inferFamily(fen: string): EndgameFamilyKind {
  return inferEndgameFamily(fen);
}

/**
 * Reject bare QvQ / RvR when trivial (≤4 pieces and only same-type majors).
 */
export function isTrivialBareMajorSymmetry(fen: string): boolean {
  if (!isBareHeavySymmetry(fen)) return false;
  const pieces =
    fen
      .split(' ')[0]!
      .replace(/\d/g, '')
      .replace(/\//g, '').length;
  // KQkq or KRkr → 4 pieces
  return pieces <= 4;
}

export function isLegalFen(fen: string): boolean {
  try {
    const g = new Chess(fen);
    return !g.isGameOver() || g.isCheck() || g.isStalemate() || g.isCheckmate();
  } catch {
    return false;
  }
}

/**
 * Structural gate for a start FEN (before / without engine).
 */
export function validateStartFen(fen: string): StructuralValidation {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return { ok: false, reason: 'illegal-fen' };
  }

  if (isKingsOnly(fen)) {
    return { ok: false, reason: 'k-vs-k' };
  }

  if (game.isInsufficientMaterial() || isTrivialInsufficientMaterial(fen)) {
    return { ok: false, reason: 'insufficient-material' };
  }

  // Dead / already finished starts are not training positions
  if (game.isGameOver()) {
    return { ok: false, reason: 'trivial-dead' };
  }

  if (isTrivialBareMajorSymmetry(fen)) {
    return { ok: false, reason: 'bare-major-symmetry' };
  }

  return {
    ok: true,
    family: inferFamily(fen),
    materialSignature: materialSignature(fen),
  };
}
