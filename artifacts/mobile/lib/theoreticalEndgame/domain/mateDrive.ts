/**
 * Elementary-mate fallback when no mate distance is available.
 *
 * Realization efficiency here is driving the enemy king to the edge and
 * corner, then mating. It is not a DTM, and it is not a centipawn rise.
 * Prefer an engine or table distance when every decision has one.
 *
 * Slack is a user move that neither tightens the box (edge, corner, mobility)
 * nor approaches with a mating piece, check, or mate. Holding an already
 * tight box while preparing the mate pattern is progress.
 */
import { Chess, type Square } from 'chess.js';
import type { PlayerColor } from './types.ts';

export type MateDriveAssessment = {
  applicable: boolean;
  demonstrated: boolean;
  slackMoves: number;
  complete: boolean;
};

const FILES = 'abcdefgh';

function sideOf(color: PlayerColor): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

function kingSquare(fen: string, color: 'w' | 'b'): { file: number; rank: number } | null {
  const game = new Chess(fen);
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p?.type === 'k' && p.color === color) return { file: f, rank: 8 - r };
    }
  }
  return null;
}

function cornerDist(king: { file: number; rank: number }): number {
  const corners = [
    { file: 0, rank: 1 },
    { file: 0, rank: 8 },
    { file: 7, rank: 1 },
    { file: 7, rank: 8 },
  ];
  return Math.min(
    ...corners.map((c) => Math.max(Math.abs(king.file - c.file), Math.abs(king.rank - c.rank))),
  );
}

function edgeDist(king: { file: number; rank: number }): number {
  return Math.min(king.file, 7 - king.file, king.rank - 1, 8 - king.rank);
}

function onEdge(king: { file: number; rank: number }): boolean {
  return king.file === 0 || king.file === 7 || king.rank === 1 || king.rank === 8;
}

function kingEscapes(fen: string, color: 'w' | 'b'): number {
  const game = new Chess(fen);
  const king = kingSquare(fen, color);
  if (!king) return 0;
  const opponent = color === 'w' ? 'b' : 'w';
  let n = 0;
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const file = king.file + df;
      const rank = king.rank + dr;
      if (file < 0 || file > 7 || rank < 1 || rank > 8) continue;
      const square = `${FILES[file]}${rank}` as Square;
      const occupant = game.get(square);
      if (occupant && occupant.color === color) continue;
      if (game.isAttacked(square, opponent)) continue;
      n += 1;
    }
  }
  return n;
}

function matingPieces(fen: string, color: 'w' | 'b'): { file: number; rank: number; type: string }[] {
  const game = new Chess(fen);
  const out: { file: number; rank: number; type: string }[] = [];
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (!p || p.color !== color) continue;
      if (p.type === 'q' || p.type === 'r' || p.type === 'b') {
        out.push({ file: f, rank: 8 - r, type: p.type });
      }
    }
  }
  return out;
}

function closestMating(pieces: { file: number; rank: number }[], king: { file: number; rank: number }): number {
  if (pieces.length === 0) return 99;
  return Math.min(...pieces.map((p) => Math.max(Math.abs(p.file - king.file), Math.abs(p.rank - king.rank))));
}

export function assessMateDrive(input: {
  initialFen: string;
  sans: string[];
  playerColor: PlayerColor;
}): MateDriveAssessment {
  const empty: MateDriveAssessment = {
    applicable: true,
    demonstrated: false,
    slackMoves: 0,
    complete: false,
  };
  const user = sideOf(input.playerColor);
  const enemy = user === 'w' ? 'b' : 'w';
  let game: Chess;
  try {
    game = new Chess(input.initialFen);
  } catch {
    return { ...empty, applicable: false };
  }

  let slack = 0;
  let userMoves = 0;
  let prevCorner = 0;
  let prevEdge = 0;
  const startKing = kingSquare(game.fen(), enemy);
  if (startKing) {
    prevCorner = cornerDist(startKing);
    prevEdge = edgeDist(startKing);
  }

  for (const san of input.sans) {
    const side = game.turn();
    const fenBefore = game.fen();
    let move: { san: string } | null = null;
    try {
      move = game.move(san);
    } catch {
      return empty;
    }
    if (!move) return empty;
    const fenAfter = game.fen();
    if (side !== user) {
      const k = kingSquare(fenAfter, enemy);
      if (k) {
        prevCorner = cornerDist(k);
        prevEdge = edgeDist(k);
      }
      continue;
    }
    userMoves += 1;
    const kingAfter = kingSquare(fenAfter, enemy);
    const kingBefore = kingSquare(fenBefore, enemy);
    const cornerAfter = kingAfter ? cornerDist(kingAfter) : prevCorner;
    const edgeAfter = kingAfter ? edgeDist(kingAfter) : prevEdge;
    const gaveCheck = move.san.includes('+') || move.san.includes('#');
    const mated = game.isCheckmate();
    const mobilityBefore = kingEscapes(fenBefore, enemy);
    const mobilityAfter = kingEscapes(fenAfter, enemy);
    const closerPiece =
      !!kingAfter &&
      closestMating(matingPieces(fenAfter, user), kingAfter) <
        closestMating(matingPieces(fenBefore, user), kingBefore ?? kingAfter);
    const userKingBefore = kingSquare(fenBefore, user);
    const userKingAfter = kingSquare(fenAfter, user);
    const kingCloser =
      !!userKingBefore &&
      !!userKingAfter &&
      !!kingAfter &&
      Math.max(Math.abs(userKingAfter.file - kingAfter.file), Math.abs(userKingAfter.rank - kingAfter.rank)) <
        Math.max(
          Math.abs(userKingBefore.file - (kingBefore ?? kingAfter).file),
          Math.abs(userKingBefore.rank - (kingBefore ?? kingAfter).rank),
        );
    const reduced = cornerAfter < prevCorner || edgeAfter < prevEdge;
    const tighter = mobilityAfter < mobilityBefore;
    const progress = reduced || tighter || gaveCheck || mated || closerPiece || kingCloser;
    if (!progress) slack += 1;
    prevCorner = cornerAfter;
    prevEdge = edgeAfter;
  }

  const mate = game.isCheckmate();
  const winner = mate ? (game.turn() === 'w' ? 'b' : 'w') : null;
  const king = kingSquare(game.fen(), enemy);
  const driven = !!king && onEdge(king);
  const demonstrated = winner === user && driven;
  return {
    applicable: true,
    demonstrated,
    slackMoves: slack,
    complete: demonstrated && userMoves > 0,
  };
}
