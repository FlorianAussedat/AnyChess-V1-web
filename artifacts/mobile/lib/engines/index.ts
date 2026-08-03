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

/**
 * Build the opponent engine for the current platform.
 *
 * - web:    real Stockfish (WASM) in a Web Worker, fully offline.
 * - native: the built-in RandomEngine, temporarily, so the app stays fully
 *           functional on Android/iOS today. When a native Stockfish transport
 *           is added (see engines/stockfish/transport.ts), switch this to
 *           `new StockfishEngine()` for native too — no other code changes.
 */
export function createOpponentEngine(options?: { elo?: number }): ChessEngine {
  if (Platform.OS === 'web') {
    return new StockfishEngine(options?.elo != null ? { elo: options.elo } : {});
  }
  return randomEngine;
}
