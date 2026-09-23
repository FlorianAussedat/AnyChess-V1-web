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
import { withInitFallback } from './withInitFallback';

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
 * - web:     StockfishEngine (WASM Worker).
 * - Android: StockfishEngine over the G1 native UciTransport (G3a Classic).
 *            RandomEngine only if native init fails.
 * - iOS:     RandomEngine (no bundled binary).
 *
 * Opening play uses this same factory (G3b). AnyLyseur stays on
 * createChessEngineService. Endgames (G4) use SharedStockfishRuntime on
 * Android/web. Elo bands are unchanged.
 */
export function createOpponentEngine(options?: {
  elo?: number;
  multiPv?: number;
  varietyMarginCp?: number;
}): ChessEngine {
  const partial: { elo?: number; multiPv?: number; varietyMarginCp?: number } = {};
  if (options?.elo != null) partial.elo = options.elo;
  if (options?.multiPv != null) partial.multiPv = options.multiPv;
  if (options?.varietyMarginCp != null) partial.varietyMarginCp = options.varietyMarginCp;

  if (Platform.OS === 'web') {
    return new StockfishEngine(partial);
  }

  if (Platform.OS === 'android') {
    return withInitFallback(new StockfishEngine(partial), randomEngine);
  }

  return randomEngine;
}
