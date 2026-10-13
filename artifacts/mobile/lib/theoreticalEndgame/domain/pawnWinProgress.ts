/**
 * Pawn-win and promotion exercises: keep the win, progress toward a
 * promotion that actually wins. No mate score and no centipawn rise.
 *
 * Slack is counted only until the pawn goal (winning Q/R promotion, or
 * stopping the pawn in queen vs pawn). The mate hunt that follows is not
 * this exercise. A promotion is winning when the new queen or rook is not
 * taken on the opponent's next move, or the promotion is checkmate.
 */
import { Chess } from 'chess.js';
import type { PlayerColor, TheoreticalThemeId } from './types.ts';

export type PawnWinAssessment = {
  applicable: boolean;
  demonstrated: boolean;
  slackMoves: number;
  winningPromotion: boolean;
  passerCreated: boolean;
  complete: boolean;
};

type PieceSq = { type: string; color: 'w' | 'b'; file: number; rank: number };

function sideOf(color: PlayerColor): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

function piecesOf(fen: string): PieceSq[] {
  const game = new Chess(fen);
  const out: PieceSq[] = [];
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (!p) continue;
      out.push({ type: p.type, color: p.color, file: f, rank: 8 - r });
    }
  }
  return out;
}

function kingOf(fen: string, color: 'w' | 'b'): PieceSq | null {
  return piecesOf(fen).find((p) => p.type === 'k' && p.color === color) ?? null;
}

function pawnsOf(fen: string, color: 'w' | 'b'): PieceSq[] {
  return piecesOf(fen).filter((p) => p.type === 'p' && p.color === color);
}

function chebyshev(a: PieceSq, b: { file: number; rank: number }): number {
  return Math.max(Math.abs(a.file - b.file), Math.abs(a.rank - b.rank));
}

function farthestPawn(pawns: PieceSq[], user: 'w' | 'b'): PieceSq | null {
  if (pawns.length === 0) return null;
  return pawns.reduce((best, p) => {
    if (user === 'w') return p.rank > best.rank ? p : best;
    return p.rank < best.rank ? p : best;
  });
}

function promoTarget(pawn: PieceSq, user: 'w' | 'b'): { file: number; rank: number } {
  return { file: pawn.file, rank: user === 'w' ? 8 : 1 };
}

function hasOpposition(fen: string, user: 'w' | 'b'): boolean {
  const ours = kingOf(fen, user);
  const theirs = kingOf(fen, user === 'w' ? 'b' : 'w');
  if (!ours || !theirs) return false;
  const df = Math.abs(ours.file - theirs.file);
  const dr = Math.abs(ours.rank - theirs.rank);
  return (df === 0 && dr === 2) || (dr === 0 && df === 2);
}

function isPasser(pawn: PieceSq, enemyPawns: PieceSq[], user: 'w' | 'b'): boolean {
  return !enemyPawns.some((enemy) => {
    if (Math.abs(enemy.file - pawn.file) > 1) return false;
    if (user === 'w') return enemy.rank > pawn.rank;
    return enemy.rank < pawn.rank;
  });
}

function lucenaBridge(fen: string, user: 'w' | 'b'): boolean {
  const rook = piecesOf(fen).find((p) => p.type === 'r' && p.color === user);
  if (!rook) return false;
  return user === 'w' ? rook.rank === 4 : rook.rank === 5;
}

function enemyPromoSquare(fen: string, user: 'w' | 'b'): { file: number; rank: number } | null {
  const enemy = farthestPawn(pawnsOf(fen, user === 'w' ? 'b' : 'w'), user === 'w' ? 'b' : 'w');
  if (!enemy) return null;
  return promoTarget(enemy, user === 'w' ? 'b' : 'w');
}

function occupies(fen: string, user: 'w' | 'b', sq: { file: number; rank: number }): boolean {
  return piecesOf(fen).some((p) => p.color === user && p.file === sq.file && p.rank === sq.rank);
}

/** Known breaks, in pedagogical order. Used so a short engine search does not skip b6. */
export function breakMoveAmong(moves: string[]): string | null {
  const preferred = ['b6', 'bxa5', 'exd5', 'dxe5', 'c6', 'a6'];
  return preferred.find((san) => moves.includes(san)) ?? null;
}

function pawnGoalReached(input: {
  themeId: string;
  winningPromotion: boolean;
  enemyPawnGone: boolean;
  passerCreated: boolean;
  userMated: boolean;
}): boolean {
  if (input.winningPromotion) return true;
  if (input.themeId === 'queen-vs-pawn' && (input.enemyPawnGone || input.userMated)) return true;
  return input.userMated && input.passerCreated;
}

export function assessPawnWin(input: {
  themeId: TheoreticalThemeId | string;
  initialFen: string;
  sans: string[];
  playerColor: PlayerColor;
  objective: 'WIN' | 'DRAW';
}): PawnWinAssessment {
  const empty: PawnWinAssessment = {
    applicable: false,
    demonstrated: false,
    slackMoves: 0,
    winningPromotion: false,
    passerCreated: false,
    complete: false,
  };
  if (input.objective !== 'WIN') return empty;
  const user = sideOf(input.playerColor);
  let game: Chess;
  try {
    game = new Chess(input.initialFen);
  } catch {
    return empty;
  }

  let slack = 0;
  let userMoves = 0;
  let winningPromotion = false;
  let passerCreated = false;
  let enemyPawnGone = pawnsOf(game.fen(), user === 'w' ? 'b' : 'w').length === 0;
  let pendingPromotionSq: string | null = null;
  let goalMet = pawnGoalReached({
    themeId: input.themeId,
    winningPromotion,
    enemyPawnGone,
    passerCreated,
    userMated: false,
  });

  for (const san of input.sans) {
    const side = game.turn();
    const fenBefore = game.fen();
    let move: { san: string; captured?: string; promotion?: string; to: string; piece: string } | null =
      null;
    try {
      move = game.move(san);
    } catch {
      return { ...empty, applicable: true };
    }
    if (!move) return { ...empty, applicable: true };
    if (side !== user) {
      if (pendingPromotionSq && move.captured && move.to === pendingPromotionSq) {
        winningPromotion = false;
        goalMet = false;
      }
      pendingPromotionSq = null;
      continue;
    }
    userMoves += 1;
    const fenAfter = game.fen();
    if (pendingPromotionSq) pendingPromotionSq = null;

    const ownBefore = pawnsOf(fenBefore, user);
    const ownAfter = pawnsOf(fenAfter, user);
    const enemyBefore = pawnsOf(fenBefore, user === 'w' ? 'b' : 'w');
    const enemyAfter = pawnsOf(fenAfter, user === 'w' ? 'b' : 'w');
    const farBefore = farthestPawn(ownBefore, user);
    const farAfter = farthestPawn(ownAfter, user);
    const kingBefore = kingOf(fenBefore, user);
    const kingAfter = kingOf(fenAfter, user);
    const enemyKingBefore = kingOf(fenBefore, user === 'w' ? 'b' : 'w');
    const enemyKingAfter = kingOf(fenAfter, user === 'w' ? 'b' : 'w');

    const promotedMajor = move.promotion === 'q' || move.promotion === 'r';
    if (promotedMajor) {
      pendingPromotionSq = move.to;
      winningPromotion = true;
    }
    const createdPasser = ownAfter.some(
      (p) =>
        isPasser(p, enemyAfter, user) &&
        !ownBefore.some((q) => q.file === p.file && q.rank === p.rank && isPasser(q, enemyBefore, user)),
    );
    if (createdPasser) passerCreated = true;
    if (enemyAfter.length === 0 && enemyBefore.length > 0) enemyPawnGone = true;

    const pawnAdvanced =
      move.piece === 'p' &&
      farBefore != null &&
      farAfter != null &&
      (user === 'w' ? farAfter.rank > farBefore.rank : farAfter.rank < farBefore.rank);
    const kingCloserToPawn =
      !!kingBefore &&
      !!kingAfter &&
      !!farBefore &&
      !!farAfter &&
      chebyshev(kingAfter, farAfter) < chebyshev(kingBefore, farBefore);
    const kingCloserToPromo =
      !!kingBefore &&
      !!kingAfter &&
      !!farBefore &&
      chebyshev(kingAfter, promoTarget(farAfter ?? farBefore, user)) <
        chebyshev(kingBefore, promoTarget(farBefore, user));
    const kingCloserToEnemy =
      !!kingBefore &&
      !!kingAfter &&
      !!enemyKingBefore &&
      !!enemyKingAfter &&
      chebyshev(kingAfter, enemyKingAfter) < chebyshev(kingBefore, enemyKingBefore);
    const gainedOpposition = !hasOpposition(fenBefore, user) && hasOpposition(fenAfter, user);
    const keptOpposition =
      move.piece === 'k' && hasOpposition(fenBefore, user) && hasOpposition(fenAfter, user);
    const builtBridge =
      input.themeId === 'lucena' && !lucenaBridge(fenBefore, user) && lucenaBridge(fenAfter, user);
    const lucenaKingOut =
      input.themeId === 'lucena' &&
      move.piece === 'k' &&
      !!kingBefore &&
      !!kingAfter &&
      (user === 'w' ? kingBefore.rank === 8 && kingAfter.rank < 8 : kingBefore.rank === 1 && kingAfter.rank > 1);
    const gaveCheck = move.san.includes('+') || move.san.includes('#');
    const lucenaCheck = input.themeId === 'lucena' && gaveCheck;
    const enemyPromo = enemyPromoSquare(fenBefore, user);
    const stoppedPawn =
      input.themeId === 'queen-vs-pawn' &&
      ((!!enemyPromo && occupies(fenAfter, user, enemyPromo) && !occupies(fenBefore, user, enemyPromo)) ||
        enemyAfter.length < enemyBefore.length ||
        gaveCheck);
    const captured = Boolean(move.captured);
    const checkmate = game.isCheckmate();
    const triangulationKing = input.themeId === 'triangulation' && move.piece === 'k';
    const breakPawn = input.themeId === 'pawn-breakthrough' && move.piece === 'p';
    const keySquareKing =
      (input.themeId === 'key-squares' || input.themeId === 'kp-vs-k' || input.themeId === 'opposition') &&
      move.piece === 'k' &&
      !!kingAfter &&
      (user === 'w' ? kingAfter.rank >= 6 : kingAfter.rank <= 3);

    const progress =
      promotedMajor ||
      pawnAdvanced ||
      kingCloserToPawn ||
      kingCloserToPromo ||
      kingCloserToEnemy ||
      gainedOpposition ||
      keptOpposition ||
      builtBridge ||
      lucenaKingOut ||
      lucenaCheck ||
      stoppedPawn ||
      captured ||
      createdPasser ||
      checkmate ||
      triangulationKing ||
      breakPawn ||
      keySquareKing ||
      (gaveCheck && (input.themeId === 'queen-vs-pawn' || winningPromotion));

    const alreadyDone = goalMet;
    const userMated = checkmate && game.turn() !== user;
    goalMet = pawnGoalReached({
      themeId: input.themeId,
      winningPromotion,
      enemyPawnGone,
      passerCreated,
      userMated,
    });
    if (!alreadyDone && !progress) slack += 1;
  }

  if (game.isCheckmate() && pendingPromotionSq) winningPromotion = true;
  const mate = game.isCheckmate();
  const winner = mate ? (game.turn() === 'w' ? 'b' : 'w') : null;
  const userMated = winner === user;
  const demonstrated = pawnGoalReached({
    themeId: input.themeId,
    winningPromotion,
    enemyPawnGone,
    passerCreated,
    userMated,
  });

  return {
    applicable: true,
    demonstrated,
    slackMoves: slack,
    winningPromotion,
    passerCreated,
    complete: demonstrated && userMoves > 0,
  };
}

/**
 * Prefer a user move that progresses the pawn-win idea (break, advance,
 * opposition, promotion). Used by automated play so a short engine search
 * does not skip a known breakthrough.
 */
export function pickPawnWinUserSan(input: {
  themeId: TheoreticalThemeId | string;
  initialFen: string;
  sans: string[];
  playerColor: PlayerColor;
  objective: 'WIN' | 'DRAW';
}): string | null {
  if (input.objective !== 'WIN') return null;
  let game: Chess;
  try {
    game = new Chess(input.initialFen);
    for (const san of input.sans) game.move(san);
  } catch {
    return null;
  }
  const user = sideOf(input.playerColor);
  if (game.turn() !== user) return null;
  if (input.themeId === 'pawn-breakthrough') {
    const breakSan = breakMoveAmong(game.moves());
    if (breakSan) return breakSan;
  }
  const current = assessPawnWin(input);
  let best: { san: string; assessment: PawnWinAssessment } | null = null;
  for (const san of game.moves()) {
    const assessment = assessPawnWin({
      ...input,
      sans: [...input.sans, san],
    });
    if (!assessment.applicable) continue;
    if (!best) {
      best = { san, assessment };
      continue;
    }
    const betterComplete = assessment.complete !== best.assessment.complete && assessment.complete;
    const betterDemo =
      assessment.demonstrated !== best.assessment.demonstrated && assessment.demonstrated;
    const betterPromo =
      assessment.winningPromotion !== best.assessment.winningPromotion && assessment.winningPromotion;
    const betterPasser =
      assessment.passerCreated !== best.assessment.passerCreated && assessment.passerCreated;
    const preferQueen = san.includes('=Q') && !best.san.includes('=Q');
    if (betterComplete || betterDemo || betterPromo || betterPasser || preferQueen) {
      best = { san, assessment };
    }
  }
  if (!best) return null;
  const gainedPasser = best.assessment.passerCreated && !current.passerCreated;
  const gainedPromo = best.assessment.winningPromotion && !current.winningPromotion;
  if (best.assessment.complete || best.assessment.demonstrated || gainedPromo || gainedPasser) {
    return best.san;
  }
  return null;
}
