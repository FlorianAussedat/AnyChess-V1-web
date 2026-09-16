/**
 * Secure practical-pressure opponent policy.
 *
 * Priority (imperative):
 * 1. Never turn a win into a draw
 * 2. Never turn a draw into a loss
 * 3. Liquidate if needed to keep the result
 * 4. Among safe moves, prefer pressure
 * 5. On doubt, play Stockfish best
 */
import { Chess } from 'chess.js';
import type { EngineAnalysisLine, EngineBestMove } from '../../engines/analysis/types.ts';
import { ENDGAME_TRAINING_CONFIG } from '../domain/types.ts';

export type PressurePick = {
  move: EngineBestMove;
  scoreCp: number;
  mateIn: number | null;
  reasons: string[];
  usedFallback: boolean;
};

function materialCount(fen: string): number {
  let n = 0;
  for (const ch of fen.split(' ')[0]!) {
    if (/[pnbrqkPNBRQK]/.test(ch)) n += 1;
  }
  return n;
}

function applyMove(fen: string, move: EngineBestMove): Chess | null {
  try {
    const g = new Chess(fen);
    g.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    return g;
  } catch {
    return null;
  }
}

function isImmediateOfficialEnd(fen: string, move: EngineBestMove): boolean {
  const g = applyMove(fen, move);
  return !!g && g.isGameOver();
}

function tradesHeavy(fen: string, move: EngineBestMove): boolean {
  const g = applyMove(fen, move);
  if (!g) return false;
  const played = g.history({ verbose: true }).at(-1);
  if (!played?.captured) return false;
  return played.captured === 'q' || played.captured === 'r';
}

/**
 * Filter MultiPV lines to objectively safe candidates relative to best.
 * Lines are STM-centric (Stockfish / opponent).
 */
export function filterSafeCandidates(
  lines: EngineAnalysisLine[],
  maxGapCp: number = ENDGAME_TRAINING_CONFIG.maxCpGapFromBest,
): EngineAnalysisLine[] {
  const withMoves = lines.filter((l) => l.bestMove != null);
  if (withMoves.length === 0) return [];

  const bestCp = Math.max(...withMoves.map((l) => l.scoreCp));
  return withMoves.filter((l) => {
    if (bestCp - l.scoreCp > maxGapCp) return false;
    // Never allow self-mate
    if (l.mateIn != null && l.mateIn < 0) return false;
    // If best is winning for STM, reject lines that collapse to heavy loss
    if (l.wdl && bestCp >= 50) {
      if (l.wdl.loss >= 700 && (withMoves.find((x) => x.scoreCp === bestCp)?.wdl?.loss ?? 0) < 300) {
        return false;
      }
    }
    return true;
  });
}

export function pickPracticalPressureMove(
  fen: string,
  lines: EngineAnalysisLine[],
  options: { maxGapCp?: number } = {},
): PressurePick | null {
  const withMoves = lines.filter((l) => l.bestMove != null) as Array<
    EngineAnalysisLine & { bestMove: EngineBestMove }
  >;
  if (withMoves.length === 0) return null;

  const best = withMoves.reduce((a, b) => (b.scoreCp > a.scoreCp ? b : a));
  const safe = filterSafeCandidates(lines, options.maxGapCp) as Array<
    EngineAnalysisLine & { bestMove: EngineBestMove }
  >;

  if (safe.length === 0) {
    return {
      move: best.bestMove,
      scoreCp: best.scoreCp,
      mateIn: best.mateIn,
      reasons: ['fallback-best-no-safe'],
      usedFallback: true,
    };
  }

  // If only one safe move, take it (may be a necessary liquidation).
  if (safe.length === 1) {
    return {
      move: safe[0]!.bestMove,
      scoreCp: safe[0]!.scoreCp,
      mateIn: safe[0]!.mateIn,
      reasons: ['only-safe'],
      usedFallback: false,
    };
  }

  const ranked = safe.map((l) => {
    let score = 0;
    const reasons: string[] = [];
    const after = applyMove(fen, l.bestMove);

    if (!isImmediateOfficialEnd(fen, l.bestMove)) {
      score += 50;
      reasons.push('avoids-immediate-end');
    } else {
      score -= 60;
      reasons.push('immediate-end');
    }

    if (!tradesHeavy(fen, l.bestMove)) {
      score += 35;
      reasons.push('keeps-heavy');
    } else {
      score -= 25;
      reasons.push('trades-heavy');
    }

    const mat = after ? materialCount(after.fen()) : 0;
    score += Math.min(25, mat * 2);

    if (l.wdl) {
      score += Math.round(l.wdl.win / 40);
    }

    // Prefer closer to best among safe
    score += Math.max(0, 15 - (best.scoreCp - l.scoreCp));

    return { line: l, score, reasons };
  });

  ranked.sort((a, b) => b.score - a.score || b.line.scoreCp - a.line.scoreCp);
  const top = ranked[0]!;
  return {
    move: top.line.bestMove,
    scoreCp: top.line.scoreCp,
    mateIn: top.line.mateIn,
    reasons: top.reasons,
    usedFallback: false,
  };
}

export function chooseOpponentMove(
  fen: string,
  analysis: {
    bestMove: EngineBestMove | null;
    lines?: EngineAnalysisLine[];
  },
): EngineBestMove | null {
  const lines = analysis.lines;
  if (!lines || lines.length <= 1) {
    return analysis.bestMove;
  }
  return pickPracticalPressureMove(fen, lines)?.move ?? analysis.bestMove;
}
