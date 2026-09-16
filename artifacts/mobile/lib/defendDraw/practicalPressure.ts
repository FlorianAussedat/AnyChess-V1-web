/**
 * Practical-pressure opponent policy for DRAW-objective endgames.
 *
 * When several moves are objectively equivalent (within a small CP window),
 * prefer the move that keeps the game going and maintains pressure rather
 * than an immediate equalizing liquidation.
 *
 * Never voluntarily plays a clearly inferior or losing move.
 */
import { Chess } from 'chess.js';
import type { EngineAnalysis, EngineAnalysisLine, EngineBestMove } from '../engines/analysis/types.ts';
import { PRACTICAL_PRESSURE_CONFIG } from './qualityConfig.ts';
import type { EndgameOpponentPolicy } from './qualityConfig.ts';
import type { DefenseAnalysis, DefenseBestMove } from './defenseTypes.ts';

export type PressureCandidate = {
  move: EngineBestMove;
  scoreCp: number;
  mateIn: number | null;
  wdl: EngineAnalysis['wdl'];
  multipv: number;
  /** Ranking score — higher is preferred among near-equal moves. */
  pressureScore: number;
  reasons: string[];
};

function materialCount(fen: string): number {
  const board = fen.split(' ')[0]!;
  let n = 0;
  for (const ch of board) {
    if (/[pnbrqkPNBRQK]/.test(ch)) n += 1;
  }
  return n;
}

function isImmediateRegulatoryEnd(fen: string, move: EngineBestMove): boolean {
  try {
    const g = new Chess(fen);
    g.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    return g.isGameOver();
  } catch {
    return false;
  }
}

function tradesLastHeavyPiece(fen: string, move: EngineBestMove): boolean {
  try {
    const before = materialCount(fen);
    const g = new Chess(fen);
    const played = g.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    if (!played?.captured) return false;
    const after = materialCount(g.fen());
    // Captured a Q/R and board nearly empty
    if ((played.captured === 'q' || played.captured === 'r') && after <= 3) {
      return true;
    }
    // Large material drop
    return before - after >= 2 && after <= 3;
  } catch {
    return false;
  }
}

function materialAfter(fen: string, move: EngineBestMove): number {
  try {
    const g = new Chess(fen);
    g.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    return materialCount(g.fen());
  } catch {
    return 0;
  }
}

/**
 * Rank near-equal MultiPV candidates by practical pressure.
 * Input lines are already from Stockfish's (STM / opponent) perspective.
 */
export function pickPracticalPressureMove(
  fen: string,
  lines: EngineAnalysisLine[],
  config: {
    maxCpGapFromBest?: number;
    rejectSelfMate?: boolean;
  } = {},
): PressureCandidate | null {
  const maxGap = config.maxCpGapFromBest ?? PRACTICAL_PRESSURE_CONFIG.maxCpGapFromBest;
  const rejectSelfMate = config.rejectSelfMate ?? PRACTICAL_PRESSURE_CONFIG.rejectSelfMate;

  const withMoves = lines.filter((l) => l.bestMove != null) as Array<
    EngineAnalysisLine & { bestMove: EngineBestMove }
  >;
  if (withMoves.length === 0) return null;

  const bestCp = Math.max(...withMoves.map((l) => l.scoreCp));
  let eligible = withMoves.filter((l) => bestCp - l.scoreCp <= maxGap);

  if (rejectSelfMate) {
    eligible = eligible.filter((l) => !(l.mateIn != null && l.mateIn < 0));
  }

  // Never allow a move that is a clear loss for Stockfish vs best
  eligible = eligible.filter((l) => {
    if (l.wdl && bestCp - l.scoreCp <= maxGap) {
      // If best is drawish/winning for SF, reject lines that flip to heavy loss
      const bestLine = withMoves.find((x) => x.scoreCp === bestCp);
      if (bestLine?.wdl && l.wdl.loss >= 700 && bestLine.wdl.loss < 400) return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    const fallback = withMoves.find((l) => l.scoreCp === bestCp) ?? withMoves[0]!;
    return {
      move: fallback.bestMove,
      scoreCp: fallback.scoreCp,
      mateIn: fallback.mateIn,
      wdl: fallback.wdl,
      multipv: fallback.multipv,
      pressureScore: 0,
      reasons: ['only-acceptable'],
    };
  }

  const ranked: PressureCandidate[] = eligible.map((l) => {
    let pressureScore = 0;
    const reasons: string[] = [];

    if (!isImmediateRegulatoryEnd(fen, l.bestMove)) {
      pressureScore += 40;
      reasons.push('avoids-immediate-end');
    } else {
      pressureScore -= 50;
      reasons.push('immediate-end');
    }

    if (!tradesLastHeavyPiece(fen, l.bestMove)) {
      pressureScore += 30;
      reasons.push('avoids-last-piece-trade');
    } else {
      pressureScore -= 40;
      reasons.push('last-piece-trade');
    }

    const mat = materialAfter(fen, l.bestMove);
    pressureScore += Math.min(20, mat * 2);
    reasons.push(`material-after-${mat}`);

    if (l.wdl) {
      pressureScore += Math.round(l.wdl.win / 50);
      reasons.push(`wdl-win-${l.wdl.win}`);
    }

    // Slight preference for closer-to-best
    pressureScore += Math.max(0, 10 - (bestCp - l.scoreCp));

    return {
      move: l.bestMove,
      scoreCp: l.scoreCp,
      mateIn: l.mateIn,
      wdl: l.wdl,
      multipv: l.multipv,
      pressureScore,
      reasons,
    };
  });

  ranked.sort((a, b) => b.pressureScore - a.pressureScore || b.scoreCp - a.scoreCp);
  return ranked[0]!;
}

export function resolveOpponentPolicy(objective: 'WIN' | 'DRAW'): EndgameOpponentPolicy {
  return objective === 'DRAW' ? 'practical-pressure' : 'strict-best';
}

/**
 * Choose opponent move from a MultiPV (or single-PV) analysis.
 * Falls back to bestMove when MultiPV lines are unavailable.
 */
export function chooseOpponentMove(
  fen: string,
  analysis: DefenseAnalysis | EngineAnalysis,
  policy: EndgameOpponentPolicy,
): DefenseBestMove | null {
  if (policy === 'strict-best') {
    return analysis.bestMove;
  }

  const lines = analysis.lines;
  if (!lines || lines.length <= 1) {
    return analysis.bestMove;
  }

  const pick = pickPracticalPressureMove(fen, lines);
  return pick?.move ?? analysis.bestMove;
}
