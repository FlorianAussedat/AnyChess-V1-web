/**
 * Defence-mode analysis types (no engine / platform imports).
 */
import type { EngineAnalysisLine, EngineBestMove } from '../engines/analysis/types.ts';

export type DefenseBestMove = EngineBestMove;

/** Side-to-move perspective. */
export type DefenseAnalysis = {
  scoreCp: number;
  mateIn: number | null;
  depth: number;
  wdl: { win: number; draw: number; loss: number } | null;
  bestMove: DefenseBestMove | null;
  /** MultiPV candidates when requested. */
  lines?: EngineAnalysisLine[];
};

export type DefenseAnalyzeOptions = {
  fen: string;
  movetimeMs?: number;
  multiPv?: number;
};

export interface DefenseAnalyzer {
  analyze(fen: string, movetimeMs?: number): Promise<DefenseAnalysis>;
  /** Optional MultiPV-aware analysis — falls back to analyze() when absent. */
  analyzePosition?(options: DefenseAnalyzeOptions): Promise<DefenseAnalysis>;
  destroy?(): void;
}
