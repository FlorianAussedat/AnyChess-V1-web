import { tMsg } from '../i18n/tMsg.ts';
import type { PlayerColor } from '../game/types.ts';

/** Whose turn it is — derived from chess.js `game.turn()`, not board viewpoint. */
export function sideToMoveLabel(sideToMove: PlayerColor): string {
  return sideToMove === 'w'
    ? tMsg('game.sideToMoveWhite')
    : tMsg('game.sideToMoveBlack');
}

/** Board flip for Jouer le coup must follow the side to move. */
export function isFlippedForSideToMove(sideToMove: PlayerColor): boolean {
  return sideToMove === 'b';
}
