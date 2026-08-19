/**
 * Draw offer logic for DRAW-objective endgames.
 * After a threshold of player moves, the player may propose a draw.
 * Stockfish evaluates the position and decides to accept or refuse.
 *
 * WDL is always normalized from Stockfish's perspective (the opponent).
 */
import type { DefenseAnalyzer, DefenseAnalysis } from './defenseTypes.ts';

export const DRAW_OFFER_CONFIG = {
  /** Minimum player moves before first draw offer is allowed. */
  minMovesBeforeOffer: 30,
  /** Moves to wait after a refusal before allowing another offer. */
  movesAfterRefusal: 10,
  /** Stockfish accepts only if its own win probability is below this (permille). */
  maxStockfishWinPermille: 200,
  /** Stockfish accepts only if draw probability >= this (permille). */
  minDrawPermille: 350,
  /** CP window — Stockfish accepts if |cp| <= this (fallback without WDL). */
  acceptCpWindow: 50,
  /** Analysis time for draw decision (ms). */
  drawDecisionTimeMs: 2000,
} as const;

export type DrawOfferResult =
  | { accepted: true }
  | { accepted: false; message: string }
  | { accepted: false; error: true; message: string };

export function canOfferDraw(
  objective: 'WIN' | 'DRAW',
  playerMovesMade: number,
  lastOfferMove: number | null,
): boolean {
  if (objective !== 'DRAW') return false;
  if (playerMovesMade < DRAW_OFFER_CONFIG.minMovesBeforeOffer) return false;
  if (
    lastOfferMove !== null &&
    playerMovesMade - lastOfferMove < DRAW_OFFER_CONFIG.movesAfterRefusal
  ) {
    return false;
  }
  return true;
}

/**
 * Evaluate whether Stockfish would accept a draw offer.
 *
 * The analysis is from the side-to-move's perspective. We normalize to
 * Stockfish's (opponent's) perspective: if the player just moved, STM is
 * the opponent, so the WDL values are already from Stockfish's POV.
 * If the player is STM, we invert.
 */
export async function evaluateDrawOffer(
  analyzer: DefenseAnalyzer,
  fen: string,
  playerColor: 'w' | 'b',
): Promise<DrawOfferResult> {
  let analysis: DefenseAnalysis;
  try {
    analysis = await analyzer.analyze(fen, DRAW_OFFER_CONFIG.drawDecisionTimeMs);
  } catch {
    return {
      accepted: false,
      error: true,
      message: "Impossible d'évaluer la proposition de nulle.",
    };
  }

  // Reject if forced mate detected for Stockfish (opponent)
  if (analysis.mateIn != null && analysis.mateIn !== 0) {
    const stm = fen.split(' ')[1] === 'w' ? 'w' : 'b';
    const stmIsOpponent = stm !== playerColor;
    const mateForOpponent =
      (stmIsOpponent && analysis.mateIn > 0) ||
      (!stmIsOpponent && analysis.mateIn < 0);
    if (mateForOpponent) {
      return { accepted: false, message: 'Stockfish refuse la nulle.' };
    }
  }

  if (analysis.wdl) {
    const stm = fen.split(' ')[1] === 'w' ? 'w' : 'b';
    const stmIsOpponent = stm !== playerColor;

    // Normalize WDL to Stockfish's (opponent's) perspective
    const sfWin = stmIsOpponent ? analysis.wdl.win : analysis.wdl.loss;
    const sfDraw = analysis.wdl.draw;

    if (
      sfWin <= DRAW_OFFER_CONFIG.maxStockfishWinPermille &&
      sfDraw >= DRAW_OFFER_CONFIG.minDrawPermille
    ) {
      return { accepted: true };
    }
    return { accepted: false, message: 'Stockfish refuse la nulle.' };
  }

  // Fallback to CP when WDL unavailable
  if (Math.abs(analysis.scoreCp) <= DRAW_OFFER_CONFIG.acceptCpWindow) {
    return { accepted: true };
  }

  return { accepted: false, message: 'Stockfish refuse la nulle.' };
}
