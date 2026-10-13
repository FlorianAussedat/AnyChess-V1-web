/**
 * Rebuild the positions the user actually decided, from the stored move list.
 * Opponent replies stay in the line and are not graded.
 */
import { Chess } from 'chess.js';
import type { PlayerColor } from '../domain/types.ts';

export type UserDecisionPoint = {
  fenBefore: string;
  san: string;
  fenAfter: string;
};

export function replayUserDecisions(
  startFen: string,
  playerColor: PlayerColor,
  moveSans: string[],
): UserDecisionPoint[] {
  let game: Chess;
  try {
    game = new Chess(startFen);
  } catch {
    return [];
  }
  const userSide = playerColor === 'white' ? 'w' : 'b';
  const points: UserDecisionPoint[] = [];
  for (const san of moveSans) {
    const fenBefore = game.fen();
    const userMove = game.turn() === userSide;
    let played: { san: string } | null = null;
    try {
      played = game.move(san);
    } catch {
      break;
    }
    if (!played) break;
    if (userMove) {
      points.push({ fenBefore, san: played.san, fenAfter: game.fen() });
    }
  }
  return points;
}
