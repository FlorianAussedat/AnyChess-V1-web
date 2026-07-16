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

export type CaptureRecord = {
  pieceType: PieceType;
  color: PieceColor;
  capturedByType: PieceType;
  capturedByColor: PieceColor;
  san: string;
  halfMoveIndex: number;
};

export type CastlingPlayed = {
  color: PieceColor;
  side: 'kingside' | 'queenside';
};

export type CastlingRightsRemaining = {
  whiteKing: boolean;
  whiteQueen: boolean;
  blackKing: boolean;
  blackQueen: boolean;
};

export type HistoryAnalysis = {
  finalFen: string;
  sans: string[];
  pieces: TrackedPiece[];
  captureHistory: CaptureRecord[];
  castlingRightsRemaining: CastlingRightsRemaining;
  castlingPlayed: CastlingPlayed[];
  /** FEN after each half-move; index 0 = after the first move. */
  fenSnapshots: string[];
  sideToMove: PieceColor;
  whiteInCheck: boolean;
  blackInCheck: boolean;
  moveCountByPieceId: Record<string, number>;
  /** Piece id that moved on each half-move (same index as sans). */
  moverPieceIdByHalfMove: (string | null)[];
  /** Square (or null) of each piece after every half-move. */
  pieceSquareTimeline: Record<string, (string | null)[]>;
  whiteSans: string[];
  blackSans: string[];
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

function parseCastlingRights(fen: string): CastlingRightsRemaining {
  const field = fen.split(' ')[2] ?? '-';
  return {
    whiteKing: field.includes('K'),
    whiteQueen: field.includes('Q'),
    blackKing: field.includes('k'),
    blackQueen: field.includes('q'),
  };
}

/**
 * Replay SANs and keep track of every original piece.
 */
export function analyzeHistory(sans: string[]): HistoryAnalysis {
  const chess = new Chess();
  const pieces = startPieces();
  const at = new Map<string, TrackedPiece>();
  for (const p of pieces) at.set(p.startSquare, p);

  const captureHistory: CaptureRecord[] = [];
  const castlingPlayed: CastlingPlayed[] = [];
  const fenSnapshots: string[] = [];
  const moveCountByPieceId: Record<string, number> = {};
  const moverPieceIdByHalfMove: (string | null)[] = [];
  const pieceSquareTimeline: Record<string, (string | null)[]> = {};
  for (const p of pieces) pieceSquareTimeline[p.id] = [];
  const whiteSans: string[] = [];
  const blackSans: string[] = [];

  const snapshotSquares = () => {
    for (const p of pieces) {
      pieceSquareTimeline[p.id].push(p.captured ? null : p.currentSquare);
    }
  };

  for (let i = 0; i < sans.length; i++) {
    const san = sans[i];
    const move = chess.move(san);
    if (!move) throw new Error(`Illegal SAN in history: ${san}`);

    if (move.color === 'w') whiteSans.push(san);
    else blackSans.push(san);

    const mover = at.get(move.from as Square);
    moverPieceIdByHalfMove.push(mover?.id ?? null);
    if (mover) {
      moveCountByPieceId[mover.id] = (moveCountByPieceId[mover.id] ?? 0) + 1;
    }

    if (move.captured) {
      const capSq = (
        move.flags.includes('e')
          ? `${move.to[0]}${move.color === 'w' ? '5' : '4'}`
          : move.to
      ) as Square;
      const victim = at.get(capSq);
      if (victim && mover) {
        victim.captured = true;
        victim.currentSquare = null;
        at.delete(capSq);
        captureHistory.push({
          pieceType: victim.type,
          color: victim.color,
          capturedByType: mover.type,
          capturedByColor: mover.color,
          san,
          halfMoveIndex: i,
        });
      }
    }

    if (mover) {
      at.delete(move.from);
      if (move.promotion) mover.type = move.promotion as PieceType;
      mover.currentSquare = move.to as Square;
      at.set(move.to, mover);
    }

    if (move.flags.includes('k') || move.flags.includes('q')) {
      const isWhite = move.color === 'w';
      const side: 'kingside' | 'queenside' = move.flags.includes('k') ? 'kingside' : 'queenside';
      castlingPlayed.push({ color: move.color, side });
      const rookFrom = (
        move.flags.includes('k') ? (isWhite ? 'h1' : 'h8') : isWhite ? 'a1' : 'a8'
      ) as Square;
      const rookTo = (
        move.flags.includes('k') ? (isWhite ? 'f1' : 'f8') : isWhite ? 'd1' : 'd8'
      ) as Square;
      const rook = at.get(rookFrom);
      if (rook) {
        moveCountByPieceId[rook.id] = (moveCountByPieceId[rook.id] ?? 0) + 1;
        at.delete(rookFrom);
        rook.currentSquare = rookTo;
        at.set(rookTo, rook);
      }
    }

    fenSnapshots.push(chess.fen());
    snapshotSquares();
  }

  const finalFen = chess.fen();
  const sideToMove = chess.turn();
  const inCheck = chess.inCheck();

  return {
    finalFen,
    sans,
    pieces,
    captureHistory,
    castlingRightsRemaining: parseCastlingRights(finalFen),
    castlingPlayed,
    fenSnapshots,
    sideToMove,
    whiteInCheck: sideToMove === 'w' && inCheck,
    blackInCheck: sideToMove === 'b' && inCheck,
    moveCountByPieceId,
    moverPieceIdByHalfMove,
    pieceSquareTimeline,
    whiteSans,
    blackSans,
  };
}

export function pieceById(pieces: TrackedPiece[], id: string): TrackedPiece | null {
  return pieces.find((p) => p.id === id) ?? null;
}

export function squareAtHalfMove(
  analysis: HistoryAnalysis,
  pieceId: string,
  halfMove: number,
): string | null {
  const timeline = analysis.pieceSquareTimeline[pieceId];
  if (!timeline || halfMove < 1 || halfMove > timeline.length) return null;
  return timeline[halfMove - 1];
}

export function pieceOnSquare(
  pieces: TrackedPiece[],
  square: string,
): TrackedPiece | null {
  return pieces.find((p) => !p.captured && p.currentSquare === square) ?? null;
}

/**
 * A piece has "left its initial square" when it is not captured, its current
 * square differs from its start square, and it is not a pawn or king.
 * (Pawns and kings are excluded from the development count.)
 */
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

export function pieceAtFen(fen: string, square: string): { type: PieceType; color: PieceColor } | null {
  const game = new Chess(fen);
  const p = game.get(square as Square);
  if (!p) return null;
  return { type: p.type as PieceType, color: p.color as PieceColor };
}

export function countPiecesOnBoard(fen: string, color: PieceColor): number {
  const game = new Chess(fen);
  let n = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell && cell.color === color) n += 1;
    }
  }
  return n;
}
