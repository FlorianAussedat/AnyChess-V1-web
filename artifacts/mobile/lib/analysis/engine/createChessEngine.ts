import type { ChessEngine } from './ChessEngine.ts';
import { createStockfishChessEngine } from './StockfishChessEngine.ts';

/** AnyLyseur engine factory — platform `createChessEngineService` (web Worker / Android process). */
export function createChessEngine(): ChessEngine {
  return createStockfishChessEngine();
}
