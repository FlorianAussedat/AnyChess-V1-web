/**
 * Analyze a move history for unambiguous mental-position questions.
 * Tracks original pieces by start square through each half-move.
 */
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type TrackedPiece = {
  id: string;
  color: PieceColor;
  type: PieceType;
  startSquare: Square;
  currentSquare: Square | null;
  captured: boolean;
};

function startPieces(): TrackedPiece[] {
  const out: TrackedPiece[] = [];
  const add = (color: PieceColor, type: PieceType, square: Square) => {
    out.push({
      id: `${color}${type}:${square}`,
      color,
      type,
      startSquare: square,
      currentSquare: square,
      captured: false,
    });
  };
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
  for (let i = 0; i < 8; i++) {
    add('w', back[i], `${files[i]}1` as Square);
    add('w', 'p', `${files[i]}2` as Square);
    add('b', 'p', `${files[i]}7` as Square);
    add('b', back[i], `${files[i]}8` as Square);
  }
  return out;
}

export type HistoryAnalysis = {
  finalFen: string;
  sans: string[];
  pieces: TrackedPiece[];
};

/**
 * Replay SANs and keep track of every original piece.
 */
export function analyzeHistory(sans: string[]): HistoryAnalysis {
  const chess = new Chess();
  const pieces = startPieces();
  const at = new Map<string, TrackedPiece>();
  for (const p of pieces) at.set(p.startSquare, p);

  for (const san of sans) {
    const move = chess.move(san);
    if (!move) throw new Error(`Illegal SAN in history: ${san}`);

    if (move.captured) {
      const capSq = (
        move.flags.includes('e')
          ? `${move.to[0]}${move.color === 'w' ? '5' : '4'}`
          : move.to
      ) as Square;
      const victim = at.get(capSq);
      if (victim) {
        victim.captured = true;
        victim.currentSquare = null;
        at.delete(capSq);
      }
    }

    const mover = at.get(move.from as Square);
    if (mover) {
      at.delete(move.from);
      if (move.promotion) mover.type = move.promotion as PieceType;
      mover.currentSquare = move.to as Square;
      at.set(move.to, mover);
    }

    if (move.flags.includes('k') || move.flags.includes('q')) {
      const isWhite = move.color === 'w';
      const rookFrom = (
        move.flags.includes('k') ? (isWhite ? 'h1' : 'h8') : isWhite ? 'a1' : 'a8'
      ) as Square;
      const rookTo = (
        move.flags.includes('k') ? (isWhite ? 'f1' : 'f8') : isWhite ? 'd1' : 'd8'
      ) as Square;
      const rook = at.get(rookFrom);
      if (rook) {
        at.delete(rookFrom);
        rook.currentSquare = rookTo;
        at.set(rookTo, rook);
      }
    }
  }

  return { finalFen: chess.fen(), sans, pieces };
}

export function pieceOnSquare(
  pieces: TrackedPiece[],
  square: string,
): TrackedPiece | null {
  return pieces.find((p) => !p.captured && p.currentSquare === square) ?? null;
}

export function countDeveloped(
  pieces: TrackedPiece[],
  color: PieceColor,
): number {
  return pieces.filter(
    (p) =>
      p.color === color &&
      !p.captured &&
      p.type !== 'p' &&
      p.type !== 'k' &&
      p.currentSquare !== null &&
      p.currentSquare !== p.startSquare,
  ).length;
}
