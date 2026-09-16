/**
 * Theoretical result from player POV.
 */
import type { PlayerColor, TheoreticalObjective } from './types.ts';

export type PlayerTheoreticalResult = 'WIN' | 'DRAW' | 'LOSS';

export function sideToMoveFromFen(fen: string): 'w' | 'b' {
  const stm = fen.trim().split(/\s+/)[1];
  return stm === 'b' ? 'b' : 'w';
}

export function playerToSide(color: PlayerColor): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

/**
 * Convert engine WDL (STM) to player theoretical result.
 * Uses permille thresholds similar to Syzygy WDL semantics.
 */
export function wdlToPlayerResult(
  wdl: { win: number; draw: number; loss: number } | null | undefined,
  sideToMove: 'w' | 'b',
  playerColor: PlayerColor,
): PlayerTheoreticalResult | null {
  if (!wdl) return null;
  const same = sideToMove === playerToSide(playerColor);
  const win = same ? wdl.win : wdl.loss;
  const loss = same ? wdl.loss : wdl.win;
  const draw = wdl.draw;
  if (loss >= 700) return 'LOSS';
  if (win >= 700) return 'WIN';
  if (draw >= 700) return 'DRAW';
  return null;
}

/**
 * Did the player lose the certified objective?
 */
export function lostTheoreticalObjective(
  objective: TheoreticalObjective,
  playerResult: PlayerTheoreticalResult,
): boolean {
  if (objective === 'WIN') {
    return playerResult === 'DRAW' || playerResult === 'LOSS';
  }
  return playerResult === 'LOSS';
}

export function meetsObjective(
  objective: TheoreticalObjective,
  playerResult: PlayerTheoreticalResult,
): boolean {
  if (objective === 'WIN') return playerResult === 'WIN';
  return playerResult === 'DRAW';
}
