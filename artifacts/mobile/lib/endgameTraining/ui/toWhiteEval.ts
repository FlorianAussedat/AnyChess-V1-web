/**
 * Convert defender-POV eval / timeline to white-centric Analyzer shapes.
 */
import type { EvalCurvePoint } from '@/components/analysis';
import type { WhiteEval } from '@/lib/analysis';
import type { DefenderColor, EvaluationPoint } from '../domain/types.ts';

/** Defender-POV cp/mate → WhiteEval (white-centric). */
export function defenderToWhiteEval(
  defenderCp: number,
  defenderMate: number | null,
  defender: DefenderColor,
): WhiteEval {
  if (defender === 'white') {
    return { cp: defenderCp, mate: defenderMate };
  }
  return {
    cp: -defenderCp,
    mate: defenderMate == null ? null : -defenderMate,
  };
}

/** Timeline (defender POV) → EvalCurve points for Analyzer EvalCurve. */
export function timelineToEvalCurvePoints(
  timeline: EvaluationPoint[],
  defender: DefenderColor,
): EvalCurvePoint[] {
  return timeline.map((p, i) => {
    const white = defenderToWhiteEval(p.scoreCp, p.mateIn, defender);
    const nodeId = `endgame-${i}-${p.playerMoveNumber}`;
    return {
      nodeId,
      analysis: {
        nodeId,
        fen: p.fen,
        evaluation: white.cp,
        mate: white.mate,
        depth: 0,
        analyzedAt: 0,
        profileId: 'fast',
      },
    };
  });
}
