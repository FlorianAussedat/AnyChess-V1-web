/**
 * Engine selection — the single place that maps platform → concrete engine.
 *
 * Keeping this decision here (and nowhere else) is what makes the engine
 * swappable: GameContext just calls `createOpponentEngine()` and talks to the
 * returned `ChessEngine` interface.
 */
import { Platform } from 'react-native';
import type { ChessEngine } from '../engine';
import { randomEngine } from './random';
import { StockfishEngine } from './stockfish';

export { OwnedEngine } from './OwnedEngine';
export type { EngineFactory } from './OwnedEngine';
export {
  ChessEngineService,
  createChessEngineService,
  createMockChessEngineService,
  STOCKFISH_PLATFORM_NOTES,
} from './analysis';
export type {
  AnalyzePositionOptions,
  ChessEngineServiceOptions,
  EngineAnalysis,
  EngineBestMove,
  EngineScore,
  EngineStatus,
  EngineWdl,
} from './analysis';

/**
 * Build the opponent engine for the current platform.
 *
 * - web:    real Stockfish (WASM) in a Web Worker, fully offline.
 * - native: RandomEngine for Classic / Openings play. AnyLyseur analysis uses
 *           `createChessEngineService` → native `UciTransport` (G2). Endgames
 *           stay on `SharedStockfishRuntime` (web-only).
 */
export function createOpponentEngine(options?: {
  elo?: number;
  multiPv?: number;
  varietyMarginCp?: number;
}): ChessEngine {
  if (Platform.OS === 'web') {
    const partial: { elo?: number; multiPv?: number; varietyMarginCp?: number } = {};
    if (options?.elo != null) partial.elo = options.elo;
    if (options?.multiPv != null) partial.multiPv = options.multiPv;
    if (options?.varietyMarginCp != null) partial.varietyMarginCp = options.varietyMarginCp;
    return new StockfishEngine(partial);
  }
  return randomEngine;
}
