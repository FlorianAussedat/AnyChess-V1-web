import type { AnyChessDifficultyId } from '../../difficulty/anyChessDifficulty.ts';
import type { DrawWalkMetrics } from '../analyzeDifficulty.ts';
import type { EndgameFamily } from '../taxonomy.ts';
import { countMaterialImbalance, pieceCount, pawnCount } from './inferTaxonomy.ts';

export type SuggestInput = {
  fen: string;
  family: EndgameFamily;
  metrics: DrawWalkMetrics | null;
  pieceCount?: number;
};

type BandScore = Record<AnyChessDifficultyId, number>;

/**
 * Assisted difficulty suggestion — combines family, material, metrics and theory.
 * Not a single formula; human review / builder balancing may override.
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
  const imbalance = countMaterialImbalance(input.fen);
  const ratio = m?.drawingRatio ?? 0.5;
  const drawing = m?.drawingMoves ?? 3;
  const legal = m?.legalMoves ?? 5;
  const critical = m?.criticalMoves ?? 0;
  const unique = m?.uniqueMoveMoments ?? 0;

  // Family priors
  switch (input.family) {
    case 'pawn':
      scores.debutant += 3;
      scores.confirme += 2;
      break;
    case 'rook':
      scores.confirme += 3;
      scores.expert += 2;
      break;
    case 'queen':
      scores.confirme += 2;
      scores.expert += 2;
      break;
    case 'minor-piece':
      scores.confirme += 2;
      scores.expert += 2;
      break;
    case 'fortress':
      scores.expert += 3;
      scores.grandMaitre += 1;
      break;
    case 'imbalanced':
      scores.expert += 2;
      scores.grandMaitre += 4;
      break;
  }

  // Q vs R theoretical draws → GM bias
  const hasQ = /[Qq]/.test(input.fen.split(' ')[0]!);
  const hasR = /[Rr]/.test(input.fen.split(' ')[0]!);
  const hasMinor = /[BNbn]/.test(input.fen.split(' ')[0]!);
  if (hasQ && hasR && !hasMinor && pawns === 0) {
    scores.grandMaitre += 6;
    scores.expert += 2;
    scores.debutant -= 4;
  }

  // Piece count
  if (pieces <= 4) scores.debutant += 2;
  else if (pieces <= 5) scores.debutant += 1;
  else if (pieces >= 7) scores.expert += 1;

  // Drawing ratio — soft signal only
  if (ratio >= 0.75 && drawing >= 4) {
    scores.debutant += 2;
    scores.grandMaitre -= 3;
    scores.expert -= 2;
  } else if (ratio <= 0.2 && drawing <= 2) {
    scores.expert += 2;
    scores.grandMaitre += 2;
    scores.debutant -= 3;
  } else if (ratio <= 0.35) {
    scores.confirme += 1;
    scores.expert += 1;
  }

  // Unique / critical moments
  if (unique >= 2) {
    scores.grandMaitre += 3;
    scores.expert += 2;
  } else if (unique === 1) {
    scores.expert += 2;
    scores.grandMaitre += 1;
    scores.debutant -= 2;
  }
  if (critical >= 3) {
    scores.expert += 2;
    scores.grandMaitre += 2;
  } else if (critical >= 1 && ratio < 0.4) {
    scores.confirme += 1;
    scores.expert += 1;
  }

  // Single / few drawing moves → expert or GM (even in pawn endings)
  if (drawing === 1 && legal >= 3) {
    scores.grandMaitre += 4;
    scores.expert += 3;
    scores.debutant -= 4;
  } else if (drawing <= 2 && ratio <= 0.35) {
    scores.expert += 3;
    scores.grandMaitre += 2;
    scores.debutant -= 2;
  }

  // K+P vs K with many drawing moves stays beginner
  if (input.family === 'pawn' && pieces <= 5 && drawing >= 3 && ratio >= 0.5) {
    scores.debutant += 4;
    scores.grandMaitre -= 4;
    scores.expert -= 2;
  }

  // Single drawing move in simple pawn endgame → confirmed not GM
  if (input.family === 'pawn' && pieces <= 5 && drawing === 1 && legal <= 8) {
    scores.confirme += 2;
    scores.grandMaitre += 1;
    scores.debutant -= 2;
  }

  // Material imbalance
  if (imbalance >= 5) {
    scores.grandMaitre += 2;
    scores.expert += 2;
  }

  // Too easy for expert/GM: almost all moves draw
  if (ratio > 0.7 && drawing >= 6) {
    scores.expert -= 4;
    scores.grandMaitre -= 5;
    scores.confirme += 2;
  }

  let best: AnyChessDifficultyId = 'confirme';
  let bestScore = -Infinity;
  for (const band of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
    if (scores[band] > bestScore) {
      bestScore = scores[band];
      best = band;
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

  if (assigned === 'grandMaitre' && family === 'pawn' && ratio > 0.6 && drawing >= 4) {
    return true;
  }
  if (assigned === 'debutant' && family === 'imbalanced') return true;
  if (assigned === 'debutant' && drawing === 1 && (metrics?.uniqueMoveMoments ?? 0) >= 1) {
    return true;
  }
  return false;
}
