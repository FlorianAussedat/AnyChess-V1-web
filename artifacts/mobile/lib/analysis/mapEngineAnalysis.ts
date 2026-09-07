import type { EngineAnalysis } from '@/lib/engines/analysis';
import type { AnalysisProfileId, EngineLine, PositionAnalysis } from './types.ts';
import {
  terminalWhiteScoreFromFen,
  toWhiteScore,
} from './scoreWhite.ts';

export function mapEngineAnalysisToPosition(
  fen: string,
  raw: EngineAnalysis,
  profileId: AnalysisProfileId,
): PositionAnalysis | null {
  if (raw.cancelled) return null;

  const terminal = terminalWhiteScoreFromFen(fen);
  if (terminal) {
    return {
      fen,
      depth: raw.depth || 0,
      lines: [],
      analyzedAt: Date.now(),
      profileId,
      evaluation: terminal.evaluation,
      mate: terminal.mate,
      bestMove: undefined,
      terminalOutcome: terminal.terminalOutcome,
    };
  }

  const linesSrc =
    raw.lines && raw.lines.length > 0
      ? raw.lines
      : [
          {
            multipv: 1,
            scoreCp: raw.scoreCp,
            mateIn: raw.mateIn,
            wdl: raw.wdl,
            depth: raw.depth,
            bestMove: raw.bestMove,
            pv: raw.bestMove?.uci ? [raw.bestMove.uci] : [],
          },
        ];

  const lines: EngineLine[] = linesSrc.map((line, index) => {
    const white = toWhiteScore(
      { scoreCp: line.scoreCp, mateIn: line.mateIn },
      fen,
    );
    const pv =
      line.pv && line.pv.length > 0
        ? line.pv
        : line.bestMove?.uci
          ? [line.bestMove.uci]
          : [];
    return {
      rank: line.multipv ?? index + 1,
      depth: line.depth,
      scoreCp: white.evaluation,
      mate: white.mate,
      pv,
      bestMove: line.bestMove?.uci ?? pv[0],
    };
  });

  lines.sort((a, b) => a.rank - b.rank);
  const headline = toWhiteScore(
    { scoreCp: raw.scoreCp, mateIn: raw.mateIn },
    fen,
  );

  return {
    fen,
    depth: raw.depth,
    lines,
    analyzedAt: Date.now(),
    profileId,
    evaluation: headline.evaluation,
    mate: headline.mate,
    bestMove: lines[0]?.bestMove ?? raw.bestMove?.uci,
    terminalOutcome: headline.terminalOutcome,
  };
}
