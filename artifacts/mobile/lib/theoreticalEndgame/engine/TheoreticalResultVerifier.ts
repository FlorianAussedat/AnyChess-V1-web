/**
 * Runtime verification when theoretical result may have been lost.
 */
import {
  lostTheoreticalObjective,
  wdlToPlayerResult,
  sideToMoveFromFen,
  type PlayerTheoreticalResult,
} from '../domain/theoreticalResult.ts';
import type { PlayerColor, TheoreticalObjective } from '../domain/types.ts';
import { THEORETICAL_ENDGAME_CONFIG } from '../domain/types.ts';

export type TheoreticalProbe = {
  wdl: { win: number; draw: number; loss: number } | null;
  mateIn: number | null;
  scoreCp: number;
  fen: string;
};

export type TheoreticalLossVerdict =
  | {
      lost: true;
      resultAfter: PlayerTheoreticalResult;
      reason: 'wdl' | 'mate' | 'forced';
    }
  | { lost: false; resultAfter: PlayerTheoreticalResult | null; reason: 'recovered' | 'uncertain' };

function probeToResult(
  probe: TheoreticalProbe,
  playerColor: PlayerColor,
): PlayerTheoreticalResult | null {
  const stm = sideToMoveFromFen(probe.fen);
  if (probe.mateIn != null) {
    const same = stm === (playerColor === 'white' ? 'w' : 'b');
    if (same && probe.mateIn > 0) return 'WIN';
    if (same && probe.mateIn < 0) return 'LOSS';
    if (!same && probe.mateIn > 0) return 'LOSS';
    if (!same && probe.mateIn < 0) return 'WIN';
  }
  return wdlToPlayerResult(probe.wdl, stm, playerColor);
}

export function verifyTheoreticalLoss(
  objective: TheoreticalObjective,
  playerColor: PlayerColor,
  initial: TheoreticalProbe,
  confirmation: TheoreticalProbe | null,
): TheoreticalLossVerdict {
  const initialResult = probeToResult(initial, playerColor);
  if (
    initialResult &&
    lostTheoreticalObjective(objective, initialResult)
  ) {
    if (!confirmation) {
      // Strong signal without confirmation
      if (
        initial.wdl &&
        (initialResult === 'LOSS'
          ? (sideToMoveFromFen(initial.fen) === (playerColor === 'white' ? 'w' : 'b')
              ? initial.wdl.loss
              : initial.wdl.win) >= THEORETICAL_ENDGAME_CONFIG.wdlLossThreshold
          : false)
      ) {
        return { lost: true, resultAfter: initialResult, reason: 'wdl' };
      }
      return { lost: false, resultAfter: initialResult, reason: 'uncertain' };
    }
    const confResult = probeToResult(confirmation, playerColor);
    if (confResult && lostTheoreticalObjective(objective, confResult)) {
      return { lost: true, resultAfter: confResult, reason: 'wdl' };
    }
    return { lost: false, resultAfter: confResult, reason: 'recovered' };
  }
  return { lost: false, resultAfter: initialResult, reason: 'recovered' };
}
