/**
 * Loss verification when player-POV eval crosses under −2.
 */
import { ENDGAME_TRAINING_CONFIG } from '../domain/types.ts';
import { crossesLossThreshold } from '../domain/AttemptScoring.ts';

export type LossProbe = {
  scoreCp: number;
  mateIn: number | null;
};

export type LossVerdict =
  | { lost: true; confirmedScoreCp: number; reason: 'threshold' | 'mate' | 'forced' }
  | { lost: false; confirmedScoreCp: number; reason: 'recovered' | 'above-threshold' };

/**
 * After a crossing probe, optionally run a deeper confirmation.
 * Returns whether the loss is confirmed.
 */
export function verifyLoss(
  initialProbe: LossProbe,
  confirmation: LossProbe | null,
): LossVerdict {
  // Forced mate against player
  if (initialProbe.mateIn != null && initialProbe.mateIn < 0) {
    return {
      lost: true,
      confirmedScoreCp: initialProbe.scoreCp,
      reason: 'mate',
    };
  }

  if (!crossesLossThreshold(initialProbe.scoreCp)) {
    return {
      lost: false,
      confirmedScoreCp: initialProbe.scoreCp,
      reason: 'above-threshold',
    };
  }

  // No confirmation available — trust initial if clearly lost
  if (!confirmation) {
    if (initialProbe.scoreCp <= ENDGAME_TRAINING_CONFIG.lossThresholdCp - 50) {
      return {
        lost: true,
        confirmedScoreCp: initialProbe.scoreCp,
        reason: 'threshold',
      };
    }
    // Borderline without confirmation: do not declare loss yet
    return {
      lost: false,
      confirmedScoreCp: initialProbe.scoreCp,
      reason: 'recovered',
    };
  }

  if (confirmation.mateIn != null && confirmation.mateIn < 0) {
    return {
      lost: true,
      confirmedScoreCp: confirmation.scoreCp,
      reason: 'mate',
    };
  }

  if (crossesLossThreshold(confirmation.scoreCp)) {
    return {
      lost: true,
      confirmedScoreCp: confirmation.scoreCp,
      reason: 'threshold',
    };
  }

  // Confirmation recovered above −2 → false alarm
  return {
    lost: false,
    confirmedScoreCp: confirmation.scoreCp,
    reason: 'recovered',
  };
}

export const LOSS_CONFIRM_THINK_MS = ENDGAME_TRAINING_CONFIG.lossConfirmThinkMs;
