/**
 * Review copy for « Défends la nulle ».
 *
 * Display only. Win/loss thresholds stay in the session.
 * Evaluations are defender-POV. A missing score is not equality.
 * A mate is shown as mate, including the internal ±(100000 − |mate|) encoding.
 */
import type { ChessNotation } from '../../chess/notation.ts';
import { formatNumberedSanForDisplay } from '../../chess/notation.ts';
import type { AttemptResult, DefenderColor } from './types.ts';
import { formatPlayerEval, sideToMoveFromFen, defenderToSide } from './EvaluationNormalizer.ts';
import type { MessageKey } from '../../i18n/messages.ts';

/** Internal mate encoding used by normalizeForDefender. Not a pawn score. */
const MATE_SENTINEL_CP = 90_000;

export type EvalDisplay =
  | { kind: 'missing' }
  | { kind: 'mate'; text: string }
  | { kind: 'score'; text: string };

export function formatReviewEval(
  scoreCp: number | null | undefined,
  mateIn: number | null | undefined,
): EvalDisplay {
  if (mateIn != null && mateIn !== 0) {
    return { kind: 'mate', text: formatPlayerEval(0, mateIn) };
  }
  if (scoreCp == null || Number.isNaN(scoreCp)) return { kind: 'missing' };
  if (Math.abs(scoreCp) >= MATE_SENTINEL_CP) {
    const distance = Math.max(1, 100_000 - Math.round(Math.abs(scoreCp)));
    const mate = scoreCp < 0 ? -distance : distance;
    return { kind: 'mate', text: formatPlayerEval(0, mate) };
  }
  return { kind: 'score', text: formatPlayerEval(scoreCp, null) };
}

export function reviewHeadlineKey(
  result: Pick<AttemptResult, 'outcome' | 'officialDrawReason' | 'checkmateWinner'> & {
    playerColor?: DefenderColor;
  },
): MessageKey {
  if (result.outcome === 'abandoned') return 'quiz.ddResultInterrupted';
  if (result.outcome === 'in-progress') return 'quiz.ddResultUnknown';
  if (result.outcome === 'loss') return 'quiz.ddResultLoss';
  if (result.checkmateWinner && result.playerColor) {
    const player = defenderToSide(result.playerColor);
    if (result.checkmateWinner === player) return 'quiz.ddResultWin';
  }
  if (result.officialDrawReason === 'stalemate') return 'quiz.ddResultStalemate';
  if (
    result.outcome === 'win-official-draw' ||
    result.outcome === 'win-30-moves'
  ) {
    return 'quiz.ddResultDraw';
  }
  return 'quiz.ddResultUnknown';
}

/**
 * Chess move number from the FEN the user moved from.
 * White: "52. Qb2". Black: "52... Qb2".
 * Returns null when that FEN is not the user's turn — never labels an opponent move as theirs.
 */
export function formatDecisiveMoveLabel(
  fenBefore: string,
  san: string,
  defender: DefenderColor,
  notation: ChessNotation,
): string | null {
  const parts = fenBefore.trim().split(/\s+/);
  if (parts.length < 6 || !san.trim()) return null;
  if (sideToMoveFromFen(fenBefore) !== defenderToSide(defender)) return null;
  const fullmove = Number(parts[5]);
  if (!Number.isFinite(fullmove) || fullmove < 1) return null;
  const prefix = defender === 'white' ? `${fullmove}. ` : `${fullmove}... `;
  return formatNumberedSanForDisplay(`${prefix}${san.trim()}`, notation);
}

export type DiagnosticView =
  | { status: 'hidden' }
  | { status: 'uncertain' }
  | {
      status: 'ready';
      /** FEN the alternatives were searched from (the position before the error). */
      fenBeforeLoss: string;
      moveLabel: string;
      before: EvalDisplay;
      after: EvalDisplay;
      alternatives: string[];
      partial: boolean;
    };

export function buildDiagnosticView(
  result: AttemptResult,
  defender: DefenderColor,
  notation: ChessNotation,
): DiagnosticView {
  if (result.outcome !== 'loss') return { status: 'hidden' };
  const fen = result.fenBeforeLoss;
  const san = result.losingSan;
  if (!fen || !san) return { status: 'uncertain' };
  const moveLabel = formatDecisiveMoveLabel(fen, san, defender, notation);
  if (!moveLabel) return { status: 'uncertain' };
  const alternatives = (result.drawAlternativesReliable
    ? (result.drawAlternatives ?? [])
    : []
  ).map((alt) => formatNumberedSanForDisplay(alt.san, notation));
  return {
    status: 'ready',
    fenBeforeLoss: fen,
    moveLabel,
    before: formatReviewEval(result.evalBeforeLossCp, result.evalBeforeLossMate),
    after: formatReviewEval(result.evalAfterLossCp, result.evalAfterLossMate),
    alternatives,
    partial: result.drawAlternativesHasMore === true && alternatives.length > 0,
  };
}

/** True when the gauge belongs on a decided win or loss review, not on a live or suspended session. */
export function showReviewGauge(outcome: AttemptResult['outcome'] | null | undefined): boolean {
  return (
    outcome === 'loss' ||
    outcome === 'win-30-moves' ||
    outcome === 'win-official-draw'
  );
}
