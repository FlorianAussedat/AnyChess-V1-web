/**
 * Convert Stockfish STM-centric scores to defender (player) POV.
 *
 * ChessEngineService reports scoreCp / mateIn / wdl for the side-to-move.
 * The UI and loss threshold always use defender POV.
 */
import type { DefenderColor } from './types.ts';

export type EngineScoreInput = {
  scoreCp: number;
  mateIn: number | null;
  /** Side to move in the analyzed FEN. */
  sideToMove: 'w' | 'b';
};

export type NormalizedEval = {
  /** Centipawns from defender's perspective. */
  scoreCp: number;
  /** Mate in N for defender (>0 defender mates, <0 defender is mated). */
  mateIn: number | null;
};

export function defenderToSide(defender: DefenderColor): 'w' | 'b' {
  return defender === 'white' ? 'w' : 'b';
}

export function sideToMoveFromFen(fen: string): 'w' | 'b' {
  const stm = fen.trim().split(/\s+/)[1];
  return stm === 'b' ? 'b' : 'w';
}

/**
 * Normalize engine score to defender POV.
 *
 * If STM === defender: keep score as-is.
 * If STM !== defender: invert (opponent's +X is defender's −X).
 */
export function normalizeForDefender(
  input: EngineScoreInput,
  defender: DefenderColor,
): NormalizedEval {
  const defenderSide = defenderToSide(defender);
  const same = input.sideToMove === defenderSide;

  if (input.mateIn != null) {
    const mateIn = same ? input.mateIn : -input.mateIn;
    // Map mate to large CP for threshold comparisons
    const scoreCp =
      mateIn > 0
        ? 100_000 - Math.abs(mateIn)
        : mateIn < 0
          ? -(100_000 - Math.abs(mateIn))
          : 0;
    return { scoreCp, mateIn };
  }

  const scoreCp = same ? input.scoreCp : -input.scoreCp;
  return { scoreCp, mateIn: null };
}

/** Format for display, e.g. −1.91 or #3. */
export function formatPlayerEval(scoreCp: number, mateIn: number | null): string {
  if (mateIn != null && mateIn !== 0) {
    return mateIn > 0 ? `#${mateIn}` : `#-${Math.abs(mateIn)}`;
  }
  const pawns = scoreCp / 100;
  const abs = Math.abs(pawns).toFixed(2);
  if (pawns > 0.005) return `+${abs}`;
  if (pawns < -0.005) return `−${abs}`;
  return '0.00';
}

/**
 * Clamp for gauge fill only — true numeric value stays elsewhere.
 * Maps [gaugeMinCp, gaugeMaxCp] → [0, 1] where 1 = green (0.00), 0 = red (−2).
 */
export function gaugeFillRatio(
  scoreCp: number,
  minCp: number = -200,
  maxCp: number = 0,
): number {
  const clamped = Math.max(minCp, Math.min(maxCp, scoreCp));
  if (maxCp === minCp) return 1;
  return (clamped - minCp) / (maxCp - minCp);
}
