import type { AnyChessDifficultyId } from '../../difficulty/anyChessDifficulty.ts';
import type { DrawWalkMetrics } from '../analyzeDifficulty.ts';
import type { EndgameFamily } from '../taxonomy.ts';
import type { EndgameTrainingStyle } from '../qualityConfig.ts';
import { pieceCount, pawnCount } from './inferTaxonomy.ts';

export type SuggestInput = {
  fen: string;
  family: EndgameFamily;
  metrics: DrawWalkMetrics | null;
  pieceCount?: number;
  trainingStyle?: EndgameTrainingStyle;
  qualityScore?: number;
};

type BandScore = Record<AnyChessDifficultyId, number>;

/**
 * Assisted difficulty suggestion based on pedagogical interest.
 *
 * Material and family describe the position; they do NOT alone set the band.
 * Removed biases (historical):
 *   - Q vs R → GM
 *   - material imbalance → GM
 *   - pawn family → débutant
 *   - rook family → expert
 *   - single drawing move → automatically GM
 */
export function suggestDefendDrawDifficulty(input: SuggestInput): AnyChessDifficultyId {
  const scores: BandScore = {
    debutant: 0,
    confirme: 0,
    expert: 0,
    grandMaitre: 0,
  };
  const m = input.metrics;
  const pieces = input.pieceCount ?? pieceCount(input.fen);
  const pawns = pawnCount(input.fen);
  const ratio = m?.drawingRatio ?? 0.5;
  const drawing = m?.drawingMoves ?? 3;
  const legal = m?.legalMoves ?? 5;
  const critical = m?.criticalMoves ?? 0;
  const unique = m?.uniqueMoveMoments ?? 0;
  const style = input.trainingStyle ?? 'practical';

  // Soft family priors only (small weights — never decisive alone)
  switch (input.family) {
    case 'pawn':
      scores.debutant += 1;
      scores.confirme += 1;
      break;
    case 'rook':
      scores.confirme += 1;
      scores.expert += 1;
      break;
    case 'queen':
      scores.confirme += 1;
      scores.expert += 1;
      break;
    case 'minor-piece':
      scores.confirme += 1;
      break;
    case 'fortress':
      scores.expert += 1;
      break;
    case 'imbalanced':
      scores.expert += 1;
      break;
  }

  // Style priors
  if (style === 'technical') {
    scores.debutant += 2;
    scores.confirme += 2;
  } else if (style === 'practical') {
    scores.confirme += 2;
    scores.expert += 1;
  } else if (style === 'critical') {
    scores.expert += 2;
    scores.confirme += 1;
  }

  // Piece count — soft
  if (pieces <= 4 && pawns <= 1) scores.debutant += 1;
  else if (pieces >= 7) scores.expert += 1;

  // Drawing ratio — soft signal
  if (ratio >= 0.75 && drawing >= 4) {
    scores.debutant += 3;
    scores.confirme += 1;
    scores.grandMaitre -= 4;
    scores.expert -= 2;
  } else if (ratio <= 0.2 && drawing <= 2) {
    scores.expert += 2;
    scores.confirme += 1;
  } else if (ratio <= 0.35) {
    scores.confirme += 1;
    scores.expert += 1;
  }

  // Unique / critical moments — main difficulty drivers
  if (unique >= 2 && critical >= 2) {
    scores.grandMaitre += 4;
    scores.expert += 2;
  } else if (unique >= 2) {
    scores.expert += 3;
    scores.grandMaitre += 1;
  } else if (unique === 1) {
    scores.expert += 2;
    scores.confirme += 1;
    scores.debutant -= 1;
  }
  if (critical >= 3) {
    scores.expert += 2;
    scores.grandMaitre += 1;
  } else if (critical >= 1 && ratio < 0.4) {
    scores.confirme += 1;
    scores.expert += 1;
  }

  // Few drawing moves alone is NOT enough for GM
  if (drawing === 1 && legal >= 3 && unique >= 1) {
    scores.expert += 2;
    scores.confirme += 1;
  } else if (drawing <= 2 && ratio <= 0.35) {
    scores.expert += 1;
    scores.confirme += 1;
  }

  // Simple technical pawn endings with several reasonable moves → débutant
  if (
    input.family === 'pawn' &&
    pieces <= 5 &&
    drawing >= 3 &&
    ratio >= 0.5 &&
    unique === 0
  ) {
    scores.debutant += 4;
    scores.grandMaitre -= 4;
    scores.expert -= 2;
  }

  // Soft positions cannot be GM / expert
  if (ratio > 0.7 && drawing >= 6) {
    scores.expert -= 4;
    scores.grandMaitre -= 6;
    scores.confirme += 2;
    scores.debutant += 1;
  }

  // GM gate: require successive difficulty signals
  if (unique < 2 || critical < 1) {
    scores.grandMaitre -= 5;
  }
  if ((input.qualityScore ?? 50) < 50) {
    scores.grandMaitre -= 3;
  }

  let best: AnyChessDifficultyId = 'confirme';
  let bestScore = -Infinity;
  for (const band of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
    if (scores[band] > bestScore) {
      bestScore = scores[band];
      best = band;
    }
  }

  // Hard GM eligibility gate
  if (best === 'grandMaitre') {
    const eligible =
      unique >= 2 &&
      critical >= 1 &&
      ratio <= 0.4 &&
      drawing <= 3 &&
      (input.qualityScore ?? 50) >= 50;
    if (!eligible) {
      best = unique >= 1 && ratio <= 0.45 ? 'expert' : 'confirme';
    }
  }

  return best;
}

/** Reject positions incoherent with their suggested band (builder gate). */
export function isIncoherentForBand(
  suggested: AnyChessDifficultyId,
  assigned: AnyChessDifficultyId,
  family: EndgameFamily,
  metrics: DrawWalkMetrics | null,
): boolean {
  const order = ['debutant', 'confirme', 'expert', 'grandMaitre'] as const;
  const si = order.indexOf(suggested);
  const ai = order.indexOf(assigned);
  if (Math.abs(si - ai) > 1) return true;

  const ratio = metrics?.drawingRatio ?? 0.5;
  const drawing = metrics?.drawingMoves ?? 2;
  const unique = metrics?.uniqueMoveMoments ?? 0;

  if (assigned === 'grandMaitre' && family === 'pawn' && ratio > 0.6 && drawing >= 4) {
    return true;
  }
  if (assigned === 'grandMaitre' && unique < 2) return true;
  if (assigned === 'debutant' && family === 'imbalanced') return true;
  if (assigned === 'debutant' && drawing === 1 && unique >= 1) {
    return true;
  }
  return false;
}
