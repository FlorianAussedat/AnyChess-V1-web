/**
 * strict-best — always play Stockfish's best move.
 */
import type { EngineBestMove } from '../analysis/types.ts';

export type StrictBestAnalysis = {
  bestMove: EngineBestMove | null;
};

export function chooseStrictBestMove(analysis: StrictBestAnalysis): EngineBestMove | null {
  return analysis.bestMove;
}
