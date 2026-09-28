/**
 * Validate a pasted FEN before opening AnyLyseur.
 * Uses chess.js — the same legalizer as the reader.
 */
import { Chess } from 'chess.js';

export type FenValidation =
  | { ok: true; fen: string }
  | { ok: false };

export function validateAnalysisFen(raw: string): FenValidation {
  const fen = raw.trim().replace(/\s+/g, ' ');
  if (!fen || fen.split(' ').length < 4) return { ok: false };
  try {
    const chess = new Chess(fen);
    return { ok: true, fen: chess.fen() };
  } catch {
    return { ok: false };
  }
}

export function isStandardStartFen(fen: string): boolean {
  return fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
}
