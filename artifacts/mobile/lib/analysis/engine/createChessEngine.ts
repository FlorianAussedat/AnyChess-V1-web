import type { ChessEngine } from './ChessEngine.ts';
import { createStockfishChessEngine } from './StockfishChessEngine.ts';

/** Default factory — web Stockfish WASM today; swappable for native later. */
export function createChessEngine(): ChessEngine {
  return createStockfishChessEngine();
}
