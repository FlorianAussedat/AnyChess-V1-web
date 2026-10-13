/**
 * Elementary-mate fallback when no mate distance is available.
 *
 * Realization efficiency here is driving the enemy king to the edge and
 * corner, then mating. It is not a DTM, and it is not a centipawn rise.
 * Prefer an engine or table distance when every decision has one.
 *
 * Slack is a user move that neither tightens the box (edge, corner, mobility)
 * nor prepares the mate pattern. A missed mate-in-1 is always slack: getting
 * a piece closer is not progress when mate was already on the board.
 *
 * Once the king is boxed (edge, few escapes), Chebyshev "closer" is not the
 * method. The king walks the opposition file (two files from the edge) one
 * axis at a time; a diagonal rush that skips that alignment is slack. Holding
 * an already tight box while lining up the mate is progress.
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

type Coord = { file: number; rank: number };

function sideOf(color: PlayerColor): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

function kingSquare(fen: string, color: 'w' | 'b'): Coord | null {
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

function cornerDist(king: Coord): number {
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

function edgeDist(king: Coord): number {
  return Math.min(king.file, 7 - king.file, king.rank - 1, 8 - king.rank);
}

function onEdge(king: Coord): boolean {
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

function closestMating(pieces: Coord[], king: Coord): number {
  if (pieces.length === 0) return 99;
  return Math.min(...pieces.map((p) => Math.max(Math.abs(p.file - king.file), Math.abs(p.rank - king.rank))));
}

function fileDist(a: Coord, b: Coord): number {
  return Math.abs(a.file - b.file);
}

function rankDist(a: Coord, b: Coord): number {
  return Math.abs(a.rank - b.rank);
}

function hasDirectOpposition(a: Coord, b: Coord): boolean {
  const df = fileDist(a, b);
  const dr = rankDist(a, b);
  return (df === 0 && dr === 2) || (dr === 0 && df === 2);
}

function isBoxed(king: Coord | null, mobility: number): boolean {
  return !!king && onEdge(king) && mobility <= 2;
}

/** Mate already on the board. chess.js SAN marks these with #. */
function hasMateInOne(fen: string): boolean {
  return new Chess(fen).moves().some((san) => san.includes('#'));
}

/**
 * KRK/KQK method once the king is boxed: walk the opposition file/rank
 * (distance 2 from the edge king) without a diagonal rush that skips the
 * alignment. Reaching that file or rank, or taking opposition, is progress.
 */
function boxedKingMethod(before: Coord, after: Coord, enemy: Coord): boolean {
  const fd0 = fileDist(before, enemy);
  const fd1 = fileDist(after, enemy);
  const rd0 = rankDist(before, enemy);
  const rd1 = rankDist(after, enemy);
  const sameRank = before.rank === after.rank;
  const sameFile = before.file === after.file;
  const fileAlign = fd1 < fd0 && fd1 >= 2 && (sameRank || fd1 === 2);
  const rankAlign = rd1 < rd0 && rd1 >= 2 && (sameFile || rd1 === 2);
  const alongFile = fd1 === 2 && rd1 < rd0;
  const alongRank = rd1 === 2 && fd1 < fd0;
  return fileAlign || rankAlign || alongFile || alongRank || hasDirectOpposition(after, enemy);
}

function maintainsCut(
  beforePieces: { file: number; rank: number; type: string }[],
  afterPieces: { file: number; rank: number; type: string }[],
  enemy: Coord,
): boolean {
  if (beforePieces.length !== 1 || afterPieces.length !== 1) return false;
  const before = beforePieces[0]!;
  const after = afterPieces[0]!;
  if (before.type !== after.type) return false;
  if (before.type !== 'r' && before.type !== 'q') return false;
  const staysOnFile = before.file === after.file;
  const staysOnRank = before.rank === after.rank;
  if (enemy.file === 0 || enemy.file === 7) {
    if (staysOnFile && Math.abs(after.file - enemy.file) === 1) return true;
  }
  if (enemy.rank === 1 || enemy.rank === 8) {
    if (staysOnRank && Math.abs(after.rank - enemy.rank) === 1) return true;
  }
  return false;
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
    let move: { san: string; piece: string } | null = null;
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
    const piecesBefore = matingPieces(fenBefore, user);
    const piecesAfter = matingPieces(fenAfter, user);
    const closerPiece =
      !!kingAfter &&
      closestMating(piecesAfter, kingAfter) < closestMating(piecesBefore, kingBefore ?? kingAfter);
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
    const missedMateInOne = hasMateInOne(fenBefore) && !move.san.includes('#');
    const boxed = isBoxed(kingBefore, mobilityBefore);
    const kingMoved = move.piece === 'k';
    const methodKing =
      boxed &&
      kingMoved &&
      !!userKingBefore &&
      !!userKingAfter &&
      !!kingBefore &&
      boxedKingMethod(userKingBefore, userKingAfter, kingBefore);
    const farKing =
      boxed &&
      kingCloser &&
      !!userKingBefore &&
      !!kingBefore &&
      Math.max(fileDist(userKingBefore, kingBefore), rankDist(userKingBefore, kingBefore)) >= 5;
    const cutHold = boxed && !kingMoved && !!kingBefore && maintainsCut(piecesBefore, piecesAfter, kingBefore);
    const edgeAlready = !!kingBefore && onEdge(kingBefore);
    const closerWhileFree = closerPiece && !edgeAlready;
    const progress =
      !missedMateInOne &&
      (reduced ||
        tighter ||
        gaveCheck ||
        mated ||
        methodKing ||
        farKing ||
        cutHold ||
        closerWhileFree ||
        (!boxed && kingCloser));
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
