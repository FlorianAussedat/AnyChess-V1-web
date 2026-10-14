import type {
  EngineAnalysis,
  EngineAnalysisLine,
} from '@/lib/engines/analysis/types.ts';
import type { AnalysisProfileId, EngineLine, PositionAnalysis } from './types.ts';
import {
  terminalWhiteScoreFromFen,
  toWhiteScore,
} from './scoreWhite.ts';
import { uciToSan } from './uciToSan.ts';

function legalUci(fen: string, uci: string | undefined): string | null {
  if (!uci || !uciToSan(fen, uci)) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4]!.toLowerCase() : '';
  return `${from}${to}${promotion}`;
}

function mapLine(
  fen: string,
  line: EngineAnalysisLine,
  index: number,
): EngineLine | null {
  const rawUci = line.bestMove?.uci ?? line.pv[0];
  const best = legalUci(fen, rawUci);
  if (!best) return null;
  const white = toWhiteScore(
    { scoreCp: line.scoreCp, mateIn: line.mateIn },
    fen,
  );
  if (white.mate == null && white.evaluation == null) return null;
  return {
    rank: line.multipv ?? index + 1,
    depth: line.depth,
    scoreCp: white.evaluation,
    mate: white.mate,
    pv: [best],
    bestMove: best,
  };
}

function headlineFromRaw(
  fen: string,
  raw: EngineAnalysis,
): { evaluation: number | null; mate: number | null } | null {
  if (raw.mateIn != null) {
    return toWhiteScore({ scoreCp: raw.scoreCp, mateIn: raw.mateIn }, fen);
  }
  if (raw.score != null) {
    return toWhiteScore({ scoreCp: raw.scoreCp, mateIn: null }, fen);
  }
  return null;
}

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
      evalPerspective: 'white',
    };
  }

  const linesSrc =
    raw.lines && raw.lines.length > 0
      ? raw.lines
      : raw.bestMove?.uci || raw.score != null || raw.mateIn != null
        ? [
            {
              multipv: 1,
              scoreCp: raw.scoreCp,
              mateIn: raw.mateIn,
              wdl: raw.wdl,
              depth: raw.depth,
              bestMove: raw.bestMove,
              pv: raw.bestMove?.uci ? [raw.bestMove.uci] : [],
            },
          ]
        : [];

  const lines: EngineLine[] = linesSrc
    .map((line, index) => mapLine(fen, line, index))
    .filter((line): line is EngineLine => line != null);
  lines.sort((a, b) => a.rank - b.rank);

  const headline = headlineFromRaw(fen, raw);
  const evaluation = headline?.evaluation ?? lines[0]?.scoreCp ?? null;
  const mate = headline?.mate ?? lines[0]?.mate ?? null;
  const hasScore = mate != null || evaluation != null;
  const searched = raw.depth > 0 || lines.some((line) => line.depth > 0);
  // A depth-0 "cp 0" with no legal move is an empty search, not equality.
  if (!searched || (!hasScore && lines.length === 0)) return null;

  const bestFromEngine = legalUci(fen, raw.bestMove?.uci);
  const bestMove = bestFromEngine ?? lines[0]?.bestMove;

  return {
    fen,
    depth: raw.depth,
    lines,
    analyzedAt: Date.now(),
    profileId,
    evaluation,
    mate,
    bestMove,
    evalPerspective: 'white',
  };
}
