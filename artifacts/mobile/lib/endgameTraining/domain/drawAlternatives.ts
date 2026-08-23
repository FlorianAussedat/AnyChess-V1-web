/**
 * Find draw-holding alternatives before the losing move (MultiPV on pre-error FEN).
 */
import { Chess } from 'chess.js';
import type { DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import {
  normalizeForDefender,
  sideToMoveFromFen,
} from './EvaluationNormalizer.ts';
import { ENDGAME_TRAINING_CONFIG } from './types.ts';
import type { DefenderColor } from './types.ts';
import { verifyLoss } from '../engine/LossVerifier.ts';

export type DrawAlternativeMove = {
  san: string;
  uci: string;
  scoreCp: number;
  mateIn: number | null;
  rank: number;
};

export type DrawAlternativesResult = {
  fenBeforeLoss: string;
  losingSan: string;
  evalBeforeCp: number;
  evalAfterCp: number;
  /** Up to 3 best alternatives that hold ≥ −200 cp (confirmed). */
  alternatives: DrawAlternativeMove[];
  /** True when engine found more than 3 qualifying moves. */
  hasMoreAlternatives: boolean;
  /** False when nothing could be confirmed reliably. */
  reliable: boolean;
};

const THRESHOLD = ENDGAME_TRAINING_CONFIG.lossThresholdCp;

function uciFromMove(m: { from: string; to: string; promotion?: string }): string {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

/**
 * Analyze position BEFORE the error with MultiPV and return holding moves.
 */
export async function findDrawAlternatives(input: {
  fenBeforeLoss: string;
  losingSan: string;
  evalBeforeCp: number;
  evalAfterCp: number;
  defender: DefenderColor;
  analyzer: DefenseAnalyzer;
}): Promise<DrawAlternativesResult> {
  const base: DrawAlternativesResult = {
    fenBeforeLoss: input.fenBeforeLoss,
    losingSan: input.losingSan,
    evalBeforeCp: input.evalBeforeCp,
    evalAfterCp: input.evalAfterCp,
    alternatives: [],
    hasMoreAlternatives: false,
    reliable: false,
  };

  if (!input.analyzer.analyzePosition) {
    return base;
  }

  let analysis;
  try {
    analysis = await input.analyzer.analyzePosition({
      fen: input.fenBeforeLoss,
      movetimeMs: ENDGAME_TRAINING_CONFIG.lossConfirmThinkMs,
      multiPv: ENDGAME_TRAINING_CONFIG.multiPv,
    });
  } catch {
    return base;
  }

  const lines = analysis.lines ?? [];
  if (lines.length === 0 && analysis.bestMove) {
    lines.push({
      multipv: 1,
      scoreCp: analysis.scoreCp,
      mateIn: analysis.mateIn,
      wdl: analysis.wdl,
      depth: analysis.depth,
      bestMove: analysis.bestMove,
    });
  }

  const holding: DrawAlternativeMove[] = [];

  for (const line of lines) {
    const bm = line.bestMove;
    if (!bm) continue;

    const clone = new Chess(input.fenBeforeLoss);
    let played;
    try {
      played = clone.move({
        from: bm.from,
        to: bm.to,
        promotion: (bm.promotion as 'q' | 'r' | 'b' | 'n') ?? 'q',
      });
    } catch {
      continue;
    }
    if (!played) continue;

    let afterAnalysis;
    try {
      afterAnalysis = await input.analyzer.analyze(
        clone.fen(),
        ENDGAME_TRAINING_CONFIG.lossConfirmThinkMs,
      );
    } catch {
      continue;
    }

    const norm = normalizeForDefender(
      {
        scoreCp: afterAnalysis.scoreCp,
        mateIn: afterAnalysis.mateIn,
        sideToMove: sideToMoveFromFen(clone.fen()),
      },
      input.defender,
    );

    const verdict = verifyLoss(
      { scoreCp: norm.scoreCp, mateIn: norm.mateIn },
      null,
    );

    if (!verdict.lost && norm.scoreCp >= THRESHOLD) {
      holding.push({
        san: played.san,
        uci: uciFromMove(bm),
        scoreCp: norm.scoreCp,
        mateIn: norm.mateIn,
        rank: line.multipv ?? holding.length + 1,
      });
    }
  }

  holding.sort((a, b) => b.scoreCp - a.scoreCp || a.rank - b.rank);

  const top = holding.slice(0, 3);
  return {
    ...base,
    alternatives: top,
    hasMoreAlternatives: holding.length > 3,
    reliable: top.length > 0,
  };
}

export function formatDrawAlternativesMessage(
  result: DrawAlternativesResult,
  formatSan: (san: string) => string,
): string {
  if (!result.reliable || result.alternatives.length === 0) {
    return 'Aucune alternative suffisamment fiable n’a pu être confirmée.';
  }

  const sans = result.alternatives.map((a) => formatSan(a.san));
  if (sans.length === 1) {
    return `La nulle pouvait être conservée avec : ${sans[0]}.`;
  }
  if (sans.length === 2) {
    return `La nulle pouvait être conservée avec : ${sans[0]} ou ${sans[1]}.`;
  }
  if (result.hasMoreAlternatives) {
    return `Parmi les coups qui permettaient de conserver la nulle : ${sans[0]}, ${sans[1]} et ${sans[2]}.\nD’autres coups maintenaient également l’équilibre.`;
  }
  return `La nulle pouvait être conservée avec : ${sans[0]}, ${sans[1]} ou ${sans[2]}.`;
}
