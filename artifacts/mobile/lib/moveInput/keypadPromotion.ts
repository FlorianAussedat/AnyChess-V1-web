/**
 * Detect when a form-complete keypad buffer needs an explicit promotion choice.
 * Does not submit moves — callers show a picker then append =Q/=D etc.
 */
import { Chess } from 'chess.js';
import type { ChessNotation } from '../preferences/types.ts';
import { keypadPieceClass } from '../chess/notation.ts';
import {
  lastMoveKeypadSegment,
  normalizeMoveKeypadBuffer,
  normalizeMoveKeypadSequence,
} from './chessMoveKeypad.ts';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const EN_PROMO: Record<PromotionPiece, string> = {
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
};

const FR_PROMO: Record<PromotionPiece, string> = {
  q: 'D',
  r: 'T',
  b: 'F',
  n: 'C',
};

/** Append notation-aware promotion suffix (=Q / =D …) on the last segment. */
export function appendPromotionSuffix(
  buffer: string,
  piece: PromotionPiece,
  notation: ChessNotation,
): string {
  const seq = normalizeMoveKeypadSequence(buffer);
  const last = lastMoveKeypadSegment(seq);
  const base = normalizeMoveKeypadBuffer(last).replace(/=[NBRQKDCFT]+$/iu, '');
  const letter = notation === 'en' ? EN_PROMO[piece] : FR_PROMO[piece];
  const withPromo = `${base}=${letter}`;
  if (!seq || !seq.includes(' ')) return withPromo;
  const idx = seq.lastIndexOf(' ');
  return `${seq.slice(0, idx)} ${withPromo}`;
}

/**
 * True when the last segment looks like a pawn move to the last rank without a
 * promotion piece, and at least one legal promotion exists in `game`.
 */
export function keypadBufferNeedsPromotion(
  buffer: string,
  fen: string,
  notation: ChessNotation = 'fr',
): boolean {
  const b = normalizeMoveKeypadBuffer(lastMoveKeypadSegment(buffer));
  if (!b || b === 'O-O' || b === 'O-O-O') return false;
  if (/=[NBRQKDCFT]/iu.test(b)) return false;

  const core = b.replace(/[+#]+$/u, '');
  const destMatch = core.match(/([a-h][18])$/u);
  if (!destMatch) return false;

  // Piece-letter moves are not pawn promotions.
  const P = keypadPieceClass(notation);
  if (new RegExp(`^[${P}]`, 'u').test(core)) return false;

  try {
    const game = new Chess(fen);
    const dest = destMatch[1]!;
    return game
      .moves({ verbose: true })
      .some((m) => m.piece === 'p' && m.to === dest && !!m.promotion);
  } catch {
    return false;
  }
}

/** Rebuild FEN from a list of English SANs (history from chess.js). */
export function fenFromSanHistory(sans: readonly string[]): string {
  const game = new Chess();
  for (const san of sans) {
    try {
      game.move(san);
    } catch {
      break;
    }
  }
  return game.fen();
}
