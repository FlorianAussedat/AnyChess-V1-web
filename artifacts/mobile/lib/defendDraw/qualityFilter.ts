/**
 * Offline quality evaluation — liquidation / terminal / pressure / score.
 * Pure chess.js + heuristics (no runtime Stockfish dependency).
 *
 * Liquidation detection targets uninteresting heavy-piece trades and
 * bare symmetrical majors — NOT technical pawn endings that resolve
 * quickly under greedy captures.
 */
import { Chess } from 'chess.js';
import {
  ENDGAME_QUALITY_CONFIG,
  type EndgameQualityMetrics,
  type EndgameQualityOverride,
  type EndgameTrainingStyle,
} from './qualityConfig.ts';
import {
  countMaterial,
  isBareHeavySymmetry,
  materialSignature,
  similarityKey,
} from './materialSignature.ts';
import type { EndgameFamily } from './taxonomy.ts';
import type { DifficultyMetrics } from './taxonomy.ts';

function materialTotal(fen: string): number {
  const c = countMaterial(fen);
  return (
    c.Q * 9 +
    c.q * 9 +
    c.R * 5 +
    c.r * 5 +
    c.B * 3 +
    c.b * 3 +
    c.N * 3 +
    c.n * 3 +
    c.P +
    c.p
  );
}

function isTerminalOrDead(game: Chess): boolean {
  return (
    game.isGameOver() ||
    game.isInsufficientMaterial() ||
    game.isStalemate() ||
    game.isCheckmate()
  );
}

function isKingsOnly(fen: string): boolean {
  const c = countMaterial(fen);
  return c.Q + c.q + c.R + c.r + c.B + c.b + c.N + c.n + c.P + c.p === 0;
}

function heavyCount(fen: string): number {
  const c = countMaterial(fen);
  return c.Q + c.q + c.R + c.r;
}

/**
 * Detect only uninteresting liquidations:
 * - bare heavy symmetry (QvQ / RvR, no pawns)
 * - mutual capture of last heavy pieces leading to dead/K-only quickly
 *
 * Does NOT reject technical pawn races that finish under greedy play.
 */
function detectHeavyLiquidation(fen: string): {
  terminalWithinPlies: number | null;
  materialReductionWithinPlies: number;
  immediateLiquidation: boolean;
} {
  const startMat = materialTotal(fen);
  const startHeavy = heavyCount(fen);

  // Bare majors with no pawns: always treat as immediate liquidation risk
  if (isBareHeavySymmetry(fen)) {
    return {
      terminalWithinPlies: 2,
      materialReductionWithinPlies: Math.max(0, startMat - 0),
      immediateLiquidation: true,
    };
  }

  // No heavy pieces → no heavy liquidation
  if (startHeavy === 0) {
    return {
      terminalWithinPlies: null,
      materialReductionWithinPlies: 0,
      immediateLiquidation: false,
    };
  }

  let immediateLiquidation = false;
  let terminalWithinPlies: number | null = null;
  let materialReductionWithinPlies = 0;

  try {
    const g0 = new Chess(fen);
    const heavyCaps = g0
      .moves({ verbose: true })
      .filter((m) => m.captured === 'q' || m.captured === 'r');

    for (const cap of heavyCaps.slice(0, 6)) {
      const g1 = new Chess(fen);
      g1.move(cap);
      const after1 = materialTotal(g1.fen());
      materialReductionWithinPlies = Math.max(
        materialReductionWithinPlies,
        startMat - after1,
      );

      if (isTerminalOrDead(g1) || isKingsOnly(g1.fen())) {
        immediateLiquidation = true;
        terminalWithinPlies = 1;
        break;
      }

      const replyHeavy = g1
        .moves({ verbose: true })
        .find((m) => m.captured === 'q' || m.captured === 'r');
      if (replyHeavy) {
        g1.move(replyHeavy);
        const after2 = materialTotal(g1.fen());
        materialReductionWithinPlies = Math.max(
          materialReductionWithinPlies,
          startMat - after2,
        );
        // Only reject if the board is truly dead — not K+P technical endings.
        if (isTerminalOrDead(g1) || isKingsOnly(g1.fen())) {
          immediateLiquidation = true;
          terminalWithinPlies = 2;
          break;
        }
      }
    }
  } catch {
    /* ignore illegal */
  }

  return { terminalWithinPlies, materialReductionWithinPlies, immediateLiquidation };
}

function computePracticalPressure(input: {
  fen: string;
  metrics?: DifficultyMetrics | null;
  family: EndgameFamily;
}): number {
  const { fen, metrics, family } = input;
  const c = countMaterial(fen);
  let score = 45;

  const ratio = metrics?.drawingRatio ?? 0.5;
  const drawing = metrics?.drawingMoves ?? 3;
  const unique = metrics?.uniqueMoveMoments ?? 0;
  const critical = metrics?.criticalMoves ?? 0;

  if (isBareHeavySymmetry(fen)) score -= 40;
  if (c.P + c.p > 0) score += 15;
  if (unique >= 1) score += 15;
  if (unique >= 2) score += 12;
  if (critical >= 1) score += 10;
  if (ratio >= 0.85 && drawing >= 10) score -= 20;
  else if (ratio >= ENDGAME_QUALITY_CONFIG.softDrawingRatio && drawing >= 12) {
    score -= 10;
  }
  if (family === 'fortress') score += 10;
  if (family === 'pawn' && c.P + c.p >= 1) score += 8;
  if (family === 'rook' && c.P + c.p >= 1) score += 10;
  if (family === 'queen' && c.P + c.p >= 1) score += 8;

  return Math.max(0, Math.min(100, score));
}

export function inferTrainingStyle(input: {
  family: EndgameFamily;
  theme?: string;
  concepts?: readonly string[];
  metrics?: DifficultyMetrics | null;
  sourceType?: string;
}): EndgameTrainingStyle {
  if (input.sourceType === 'lichess') return 'critical';
  const unique = input.metrics?.uniqueMoveMoments ?? 0;
  const critical = input.metrics?.criticalMoves ?? 0;
  const concepts = input.concepts ?? [];
  const technicalConcepts = new Set([
    'opposition',
    'square-of-pawn',
    'lucena',
    'philidor',
    'bridge',
    'key-squares',
  ]);
  if (concepts.some((c) => technicalConcepts.has(c))) return 'technical';
  if (unique >= 1 || critical >= 2) return 'critical';
  return 'practical';
}

export function evaluateEndgameQuality(input: {
  fen: string;
  family: EndgameFamily;
  playerColor: 'w' | 'b';
  theme?: string;
  metrics?: DifficultyMetrics | null;
  trainingStyle?: EndgameTrainingStyle;
  qualityOverride?: EndgameQualityOverride;
}): EndgameQualityMetrics {
  const style = input.trainingStyle ?? 'practical';
  const sim = similarityKey({
    fen: input.fen,
    family: input.family,
    playerColor: input.playerColor,
    theme: input.theme,
    trainingStyle: style,
  });

  const liq = detectHeavyLiquidation(input.fen);
  const practicalPressure = computePracticalPressure({
    fen: input.fen,
    metrics: input.metrics,
    family: input.family,
  });

  const rejectionReasons: string[] = [];
  const ratio = input.metrics?.drawingRatio ?? 0.5;
  const drawing = input.metrics?.drawingMoves ?? 0;
  const unique = input.metrics?.uniqueMoveMoments ?? 0;

  if (!input.qualityOverride?.keep) {
    if (isBareHeavySymmetry(input.fen) && ENDGAME_QUALITY_CONFIG.rejectBareHeavySymmetry) {
      rejectionReasons.push('bare-heavy-symmetry');
    }
    if (liq.immediateLiquidation) {
      rejectionReasons.push('immediate-liquidation');
    }
    if (
      liq.terminalWithinPlies != null &&
      liq.terminalWithinPlies <= ENDGAME_QUALITY_CONFIG.maxLiquidationPlies
    ) {
      rejectionReasons.push(`terminal-within-${liq.terminalWithinPlies}-plies`);
    }
    // Soft drawing only rejects when there is no critical content
    if (
      ratio >= ENDGAME_QUALITY_CONFIG.softDrawingRatio &&
      drawing >= ENDGAME_QUALITY_CONFIG.softDrawingMovesMin &&
      unique === 0
    ) {
      rejectionReasons.push('soft-drawing-ratio');
    }
    if (practicalPressure < ENDGAME_QUALITY_CONFIG.minPracticalPressure) {
      rejectionReasons.push('low-practical-pressure');
    }
  }

  let qualityScore = practicalPressure;
  if (liq.immediateLiquidation) qualityScore -= 35;
  if (isBareHeavySymmetry(input.fen)) qualityScore -= 20;
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  if (
    !input.qualityOverride?.keep &&
    qualityScore < ENDGAME_QUALITY_CONFIG.minQualityScore &&
    rejectionReasons.length > 0
  ) {
    if (!rejectionReasons.includes('low-quality-score')) {
      rejectionReasons.push('low-quality-score');
    }
  }

  return {
    immediateLiquidation: liq.immediateLiquidation,
    terminalWithinPlies: liq.terminalWithinPlies,
    materialReductionWithinPlies: liq.materialReductionWithinPlies,
    practicalPressure,
    similarityKey: sim,
    qualityScore,
    rejectionReasons: [...new Set(rejectionReasons)],
  };
}

export function shouldRejectForQuality(
  metrics: EndgameQualityMetrics,
  override?: EndgameQualityOverride,
): boolean {
  if (override?.keep) return false;
  // Reject only on hard quality failures — not soft score alone
  const hard = metrics.rejectionReasons.filter(
    (r) =>
      r === 'bare-heavy-symmetry' ||
      r === 'immediate-liquidation' ||
      r.startsWith('terminal-within-') ||
      r === 'soft-drawing-ratio' ||
      r === 'low-practical-pressure',
  );
  return hard.length > 0;
}

export { materialSignature };
