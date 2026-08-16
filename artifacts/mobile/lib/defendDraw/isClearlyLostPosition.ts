/**
 * Prudent "clearly lost" detection for Défends la nulle (defender POV).
 * Mate is decisive; otherwise require a very strong / stable signal — never a small eval.
 */
import type { DefenseAnalysis } from './StockfishAnalysisService.ts';

export type ClearlyLostReason = 'mate' | 'wdl' | 'cp' | null;

export type ClearlyLostVerdict = {
  lost: boolean;
  reason: ClearlyLostReason;
  /** Score from the defending player's perspective (negative = worse for defender). */
  defenderScoreCp: number;
  /** Loss permille for the defender when WDL is available. */
  defenderLossPermille: number | null;
};

/** Cas B: require this many consecutive strong-loss signals (not mate). */
export const CLEARLY_LOST_STREAK_REQUIRED = 2;

/** WDL loss permille (0–1000) that counts as "very likely lost". */
export const CLEARLY_LOST_WDL_LOSS_MIN = 900;

/** Max draw permille allowed alongside a high loss reading. */
export const CLEARLY_LOST_WDL_DRAW_MAX = 80;

/**
 * Centipawn threshold from defender POV (≈ −6.5 pawns).
 * Deliberately far from −100 — unpleasant ≠ lost.
 */
export const CLEARLY_LOST_CP_MAX = -650;

/** Prefer deeper searches for Cas B when available. */
export const CLEARLY_LOST_MIN_DEPTH = 8;

function stmIsDefender(fen: string, playerColor: 'w' | 'b'): boolean {
  const stm = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  return stm === playerColor;
}

/**
 * Single-analysis verdict from the defender's point of view.
 * Does not apply streak/stability — callers accumulate consecutive Cas B hits.
 */
export function evaluateClearlyLostSignal(
  analysis: DefenseAnalysis,
  fen: string,
  playerColor: 'w' | 'b',
): ClearlyLostVerdict {
  const defenderToMove = stmIsDefender(fen, playerColor);
  const defenderScoreCp = defenderToMove ? analysis.scoreCp : -analysis.scoreCp;

  // Cas A — forced mate against the defender
  if (analysis.mateIn != null && analysis.mateIn !== 0) {
    const mateAgainstDefender =
      (defenderToMove && analysis.mateIn < 0) ||
      (!defenderToMove && analysis.mateIn > 0);
    if (mateAgainstDefender) {
      return {
        lost: true,
        reason: 'mate',
        defenderScoreCp,
        defenderLossPermille: null,
      };
    }
  }

  let defenderLossPermille: number | null = null;
  if (analysis.wdl) {
    defenderLossPermille = defenderToMove ? analysis.wdl.loss : analysis.wdl.win;
    const defenderDraw = analysis.wdl.draw;
    if (
      analysis.depth >= CLEARLY_LOST_MIN_DEPTH &&
      defenderLossPermille >= CLEARLY_LOST_WDL_LOSS_MIN &&
      defenderDraw <= CLEARLY_LOST_WDL_DRAW_MAX
    ) {
      return {
        lost: true,
        reason: 'wdl',
        defenderScoreCp,
        defenderLossPermille,
      };
    }
  }

  // CP fallback only when WDL missing — still very conservative
  if (
    !analysis.wdl &&
    analysis.depth >= CLEARLY_LOST_MIN_DEPTH &&
    defenderScoreCp <= CLEARLY_LOST_CP_MAX
  ) {
    return {
      lost: true,
      reason: 'cp',
      defenderScoreCp,
      defenderLossPermille,
    };
  }

  return {
    lost: false,
    reason: null,
    defenderScoreCp,
    defenderLossPermille,
  };
}

/**
 * Central helper: combine the latest signal with a consecutive-loss streak.
 * Mate (Cas A) loses immediately; Cas B needs CLEARLY_LOST_STREAK_REQUIRED hits.
 */
export function isClearlyLostPosition(
  analysis: DefenseAnalysis,
  fen: string,
  playerColor: 'w' | 'b',
  previousCasBStreak: number,
): { clearlyLost: boolean; nextStreak: number; verdict: ClearlyLostVerdict } {
  const verdict = evaluateClearlyLostSignal(analysis, fen, playerColor);
  if (!verdict.lost) {
    return { clearlyLost: false, nextStreak: 0, verdict };
  }
  if (verdict.reason === 'mate') {
    return { clearlyLost: true, nextStreak: previousCasBStreak, verdict };
  }
  const nextStreak = previousCasBStreak + 1;
  return {
    clearlyLost: nextStreak >= CLEARLY_LOST_STREAK_REQUIRED,
    nextStreak,
    verdict,
  };
}
