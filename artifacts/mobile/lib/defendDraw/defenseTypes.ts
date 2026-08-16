/**
 * Defence-mode analysis types (no engine / platform imports).
 */
import type { EngineBestMove } from '../engines/analysis/types.ts';

export type DefenseBestMove = EngineBestMove;

/** Side-to-move perspective. */
export type DefenseAnalysis = {
  scoreCp: number;
  mateIn: number | null;
  depth: number;
  wdl: { win: number; draw: number; loss: number } | null;
  bestMove: DefenseBestMove | null;
};

export interface DefenseAnalyzer {
  analyze(fen: string, movetimeMs?: number): Promise<DefenseAnalysis>;
  destroy?(): void;
}
