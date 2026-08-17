/**
 * FEN / start-position legality gates for Défends la nulle.
 */
import { Chess } from 'chess.js';
import type { DefendDrawPosition } from './positions.ts';

export type FenValidationResult =
  | { ok: true; game: Chess }
  | { ok: false; reason: string };

/**
 * Parse + structural checks before a start may be shown.
 */
export function validateDefendDrawFen(
  fen: string,
  defenderColor: 'w' | 'b',
): FenValidationResult {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'FEN unparsable',
    };
  }

  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) {
    return { ok: false, reason: 'FEN missing fields' };
  }
  const stm = parts[1] === 'b' ? 'b' : parts[1] === 'w' ? 'w' : null;
  if (!stm) return { ok: false, reason: 'Invalid side to move' };
  if (stm !== defenderColor) {
    return {
      ok: false,
      reason: `defenderColor ${defenderColor} != side to move ${stm}`,
    };
  }
  if (game.turn() !== defenderColor) {
    return { ok: false, reason: 'chess.js turn mismatch with defenderColor' };
  }

  const pieces = game
    .board()
    .flat()
    .filter(Boolean) as { type: string; color: 'w' | 'b' }[];
  const whiteKings = pieces.filter((p) => p.type === 'k' && p.color === 'w');
  const blackKings = pieces.filter((p) => p.type === 'k' && p.color === 'b');
  if (whiteKings.length !== 1 || blackKings.length !== 1) {
    return { ok: false, reason: 'Board must contain exactly one king per side' };
  }

  // Side to move must not already be checkmated / game-over at start.
  if (game.isGameOver()) {
    return { ok: false, reason: 'Start position is already game-over' };
  }

  return { ok: true, game };
}

export function isDefendDrawStartLegal(pos: DefendDrawPosition): boolean {
  return validateDefendDrawFen(pos.fen, pos.defenderColor).ok;
}
