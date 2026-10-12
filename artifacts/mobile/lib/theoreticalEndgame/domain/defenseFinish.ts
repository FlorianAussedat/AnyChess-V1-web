/**
 * Finish conditions for defensive theoretical exercises.
 *
 * A 0.00 evaluation does not end the exercise. A fixed move count does not
 * prove the defence. The technical cap (see THEORETICAL_ENDGAME_CONFIG) is
 * applied by the session and yields no grade.
 *
 * Philidor: the user's rook stands on the rank directly in front of the pawn
 * and cuts the enemy king off, after a user move. If the pawn reaches the
 * 6th rank, a check from behind is also required. Capturing the pawn ends it.
 *
 * Vancura: after a user move, the user's rook shares the rook-pawn's rank
 * and is not on the pawn's file (lateral attack). Capturing the pawn ends it.
 *
 * Bad bishop: the defending king reaches the promotion corner of the rook
 * pawn (the corner the bishop does not control).
 *
 * Lateral checks: the user gives two rank-checks at a distance of at least
 * three files. A closer check is slack, not proof. Capturing the pawn ends it.
 *
 * Pawn-square defence: the king enters the square, or captures the pawn.
 * Slack is a king move that increases the distance to the square while outside.
 */
import { Chess, type Square } from 'chess.js';
import type { PlayerColor, TheoreticalThemeId } from './types.ts';

export type DefenseAssessment = {
  applicable: boolean;
  demonstrated: boolean;
  slackMoves: number;
  /** True when the exercise may end as a success. */
  complete: boolean;
};

const FILES = 'abcdefgh';

function sideOf(color: PlayerColor): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

type PieceSq = { type: string; color: 'w' | 'b'; file: number; rank: number; sq: string };

function piecesOf(fen: string): PieceSq[] {
  const game = new Chess(fen);
  const out: PieceSq[] = [];
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (!p) continue;
      const rank = 8 - r;
      out.push({
        type: p.type,
        color: p.color,
        file: f,
        rank,
        sq: `${FILES[f]}${rank}`,
      });
    }
  }
  return out;
}

function replay(initialFen: string, sans: string[]): string[] {
  const game = new Chess(initialFen);
  const fens = [game.fen()];
  for (const san of sans) {
    game.move(san);
    fens.push(game.fen());
  }
  return fens;
}

function userIndexes(initialFen: string, player: PlayerColor, sans: string[]): number[] {
  const stm = initialFen.split(' ')[1] === 'b' ? 'b' : 'w';
  const user = sideOf(player);
  const indexes: number[] = [];
  for (let i = 0; i < sans.length; i++) {
    const turn = i % 2 === 0 ? stm : stm === 'w' ? 'b' : 'w';
    if (turn === user) indexes.push(i + 1);
  }
  return indexes;
}

function pawnSquareBoxes(pawnFile: number, pawnRank: number, whitePawn: boolean): {
  minF: number;
  maxF: number;
  minR: number;
  maxR: number;
} {
  const dist = whitePawn ? 8 - pawnRank : pawnRank - 1;
  if (whitePawn) {
    return {
      minF: pawnFile,
      maxF: Math.min(7, pawnFile + dist),
      minR: pawnRank,
      maxR: Math.min(8, pawnRank + dist),
    };
  }
  return {
    minF: Math.max(0, pawnFile - dist),
    maxF: pawnFile,
    minR: Math.max(1, pawnRank - dist),
    maxR: pawnRank,
  };
}

function insideBox(
  file: number,
  rank: number,
  box: { minF: number; maxF: number; minR: number; maxR: number },
): boolean {
  return file >= box.minF && file <= box.maxF && rank >= box.minR && rank <= box.maxR;
}

function distToBox(
  file: number,
  rank: number,
  box: { minF: number; maxF: number; minR: number; maxR: number },
): number {
  const df = file < box.minF ? box.minF - file : file > box.maxF ? file - box.maxF : 0;
  const dr = rank < box.minR ? box.minR - rank : rank > box.maxR ? rank - box.maxR : 0;
  return Math.max(df, dr);
}

function solePawn(fen: string): PieceSq | null {
  const pawns = piecesOf(fen).filter((p) => p.type === 'p');
  return pawns.length === 1 ? pawns[0]! : null;
}

export function assessDefense(input: {
  themeId: TheoreticalThemeId | string;
  initialFen: string;
  sans: string[];
  playerColor: PlayerColor;
  objective: 'WIN' | 'DRAW';
}): DefenseAssessment {
  const theme = input.themeId;
  const drawThemes = new Set([
    'philidor',
    'vancura',
    'bad-bishop',
    'lateral-checks',
    'pawn-square',
    'rook-pawn',
  ]);
  if (!drawThemes.has(theme) || input.objective !== 'DRAW') {
    return { applicable: false, demonstrated: false, slackMoves: 0, complete: false };
  }

  let fens: string[];
  try {
    fens = replay(input.initialFen, input.sans);
  } catch {
    return { applicable: true, demonstrated: false, slackMoves: 0, complete: false };
  }
  const userAt = new Set(userIndexes(input.initialFen, input.playerColor, input.sans));
  const user = sideOf(input.playerColor);

  if (theme === 'pawn-square') return assessSquare(fens, userAt, user);
  if (theme === 'bad-bishop') return assessBadBishop(fens, userAt, user);
  if (theme === 'philidor') return assessPhilidor(fens, userAt, user);
  if (theme === 'vancura') return assessVancura(fens, userAt, user);
  if (theme === 'lateral-checks') return assessLateral(input.initialFen, input.sans, userAt, user);
  if (theme === 'rook-pawn') return assessRookPawn(fens, userAt, user);
  return { applicable: false, demonstrated: false, slackMoves: 0, complete: false };
}

function assessSquare(fens: string[], userAt: Set<number>, user: 'w' | 'b'): DefenseAssessment {
  let slack = 0;
  let entered = false;
  let captured = false;
  let prevDist: number | null = null;
  for (let i = 0; i < fens.length; i++) {
    const pawn = solePawn(fens[i]!);
    if (!pawn) {
      if (userAt.has(i)) captured = true;
      continue;
    }
    const king = piecesOf(fens[i]!).find((p) => p.type === 'k' && p.color === user);
    if (!king) continue;
    const box = pawnSquareBoxes(pawn.file, pawn.rank, pawn.color === 'w');
    const dist = distToBox(king.file, king.rank, box);
    if (insideBox(king.file, king.rank, box)) entered = true;
    if (userAt.has(i) && prevDist != null && dist > prevDist && !insideBox(king.file, king.rank, box)) {
      slack += 1;
    }
    prevDist = dist;
  }
  const demonstrated = entered || captured;
  return {
    applicable: true,
    demonstrated,
    slackMoves: slack,
    complete: demonstrated && userAt.size > 0,
  };
}

function promotionCorner(pawn: PieceSq): string {
  return `${FILES[pawn.file]}${pawn.color === 'w' ? 8 : 1}`;
}

function assessBadBishop(fens: string[], userAt: Set<number>, user: 'w' | 'b'): DefenseAssessment {
  const pawn0 = solePawn(fens[0]!);
  if (!pawn0 || (pawn0.file !== 0 && pawn0.file !== 7)) {
    return { applicable: true, demonstrated: false, slackMoves: 0, complete: false };
  }
  const corner = promotionCorner(pawn0);
  const cf = corner.charCodeAt(0) - 97;
  const cr = Number(corner[1]);
  let slack = 0;
  let reached = false;
  let prev = 99;
  for (let i = 0; i < fens.length; i++) {
    const king = piecesOf(fens[i]!).find((p) => p.type === 'k' && p.color === user);
    if (!king) continue;
    const dist = Math.max(Math.abs(king.file - cf), Math.abs(king.rank - cr));
    if (king.sq === corner && userAt.has(i)) reached = true;
    if (userAt.has(i) && dist > prev) slack += 1;
    prev = dist;
  }
  return { applicable: true, demonstrated: reached, slackMoves: slack, complete: reached };
}

function assessPhilidor(fens: string[], userAt: Set<number>, user: 'w' | 'b'): DefenseAssessment {
  let barrier = false;
  let rear = false;
  let captured = false;
  let slack = 0;
  let pawnWasHigh = false;
  for (let i = 0; i < fens.length; i++) {
    const pawn = solePawn(fens[i]!);
    if (!pawn) {
      if (userAt.has(i)) captured = true;
      continue;
    }
    const whitePawn = pawn.color === 'w';
    const high = whitePawn ? pawn.rank >= 6 : pawn.rank <= 3;
    if (high) pawnWasHigh = true;
    const critical = whitePawn ? pawn.rank + 1 : pawn.rank - 1;
    const rook = piecesOf(fens[i]!).find((p) => p.type === 'r' && p.color === user);
    const enemyKing = piecesOf(fens[i]!).find((p) => p.type === 'k' && p.color !== user);
    const onBarrier = !!rook && rook.rank === critical;
    const cuts =
      onBarrier &&
      !!enemyKing &&
      (whitePawn ? enemyKing.rank <= pawn.rank : enemyKing.rank >= pawn.rank);
    if (userAt.has(i) && cuts) barrier = true;
    if (userAt.has(i) && !high && !onBarrier && barrier) slack += 1;
    if (userAt.has(i) && high && rook && enemyKing && rook.file === enemyKing.file) {
      const behind = whitePawn ? rook.rank < enemyKing.rank : rook.rank > enemyKing.rank;
      if (behind) rear = true;
    }
  }
  const complete = (captured || (barrier && (!pawnWasHigh || rear))) && userAt.size > 0;
  return {
    applicable: true,
    demonstrated: barrier || captured,
    slackMoves: slack,
    complete,
  };
}

function assessVancura(fens: string[], userAt: Set<number>, user: 'w' | 'b'): DefenseAssessment {
  let lateral = false;
  let captured = false;
  let slack = 0;
  let had = false;
  for (let i = 0; i < fens.length; i++) {
    const pawns = piecesOf(fens[i]!).filter((p) => p.type === 'p');
    const pawn = pawns.find((p) => p.file === 0 || p.file === 7) ?? null;
    if (!pawn) {
      if (userAt.has(i)) captured = true;
      continue;
    }
    const rook = piecesOf(fens[i]!).find((p) => p.type === 'r' && p.color === user);
    const onSide = !!rook && rook.rank === pawn.rank && rook.file !== pawn.file;
    if (userAt.has(i) && onSide) {
      lateral = true;
      had = true;
    } else if (userAt.has(i) && had && !onSide) {
      slack += 1;
    }
  }
  return {
    applicable: true,
    demonstrated: lateral || captured,
    slackMoves: slack,
    complete: (lateral || captured) && userAt.size > 0,
  };
}

function assessLateral(
  initialFen: string,
  sans: string[],
  userAt: Set<number>,
  user: 'w' | 'b',
): DefenseAssessment {
  const game = new Chess(initialFen);
  let goodChecks = 0;
  let slack = 0;
  let captured = false;
  for (let i = 0; i < sans.length; i++) {
    const beforePawn = solePawn(game.fen());
    let played;
    try {
      played = game.move(sans[i]!);
    } catch {
      break;
    }
    if (!played) break;
    const ply = i + 1;
    if (!userAt.has(ply)) continue;
    const afterPawn = solePawn(game.fen());
    if (beforePawn && !afterPawn) captured = true;
    const isRankCheck =
      played.color === user &&
      game.inCheck() &&
      played.piece === 'r' &&
      played.from[1] === played.to[1];
    if (!isRankCheck) continue;
    const king = piecesOf(game.fen()).find((p) => p.type === 'k' && p.color !== user);
    const file = played.to.charCodeAt(0) - 97;
    const dist = king ? Math.abs(king.file - file) : 0;
    if (dist >= 3) goodChecks += 1;
    else slack += 1;
  }
  const demonstrated = goodChecks >= 2 || captured;
  return {
    applicable: true,
    demonstrated,
    slackMoves: slack,
    complete: demonstrated,
  };
}

function assessRookPawn(fens: string[], userAt: Set<number>, user: 'w' | 'b'): DefenseAssessment {
  const pawn0 = solePawn(fens[0]!);
  if (!pawn0) return { applicable: true, demonstrated: false, slackMoves: 0, complete: false };
  const corner = promotionCorner(pawn0);
  const cf = corner.charCodeAt(0) - 97;
  const cr = Number(corner[1]);
  let reached = false;
  let captured = false;
  let slack = 0;
  let prev = 99;
  for (let i = 0; i < fens.length; i++) {
    const pawn = solePawn(fens[i]!);
    if (!pawn && userAt.has(i)) captured = true;
    const king = piecesOf(fens[i]!).find((p) => p.type === 'k' && p.color === user);
    if (!king) continue;
    const dist = Math.max(Math.abs(king.file - cf), Math.abs(king.rank - cr));
    if (userAt.has(i) && (king.sq === corner || king.sq === `${FILES[cf]}${cr === 8 ? 7 : 2}`)) {
      reached = true;
    }
    if (userAt.has(i) && dist > prev) slack += 1;
    prev = dist;
  }
  const demonstrated = reached || captured;
  return {
    applicable: true,
    demonstrated,
    slackMoves: slack,
    complete: demonstrated && userAt.size > 0,
  };
}

export function squareOfPawnForTests(pawn: Square, whitePawn: boolean): string[] {
  const file = pawn.charCodeAt(0) - 97;
  const rank = Number(pawn[1]);
  const box = pawnSquareBoxes(file, rank, whitePawn);
  const squares: string[] = [];
  for (let f = box.minF; f <= box.maxF; f++) {
    for (let r = box.minR; r <= box.maxR; r++) squares.push(`${FILES[f]}${r}`);
  }
  return squares;
}
