/**
 * Native / default factory — product analysis is still `unavailable` on Android
 * in G1. The native `UciTransport` exists (`lib/engines/stockfish/transport.ts`)
 * but is not injected here so Classic / AnyLyseur / endgames stay unwired.
 *
 * Web uses `createChessEngineService.web.ts` (Metro platform resolve).
 */
import { ChessEngineService } from './ChessEngineService.ts';
import type { ChessEngineServiceOptions } from './types.ts';

export type CreateChessEngineServiceOptions = ChessEngineServiceOptions;

export function createChessEngineService(
  options: CreateChessEngineServiceOptions = {},
): ChessEngineService {
  // If a caller injects a real transport (tests / future native), use it.
  return new ChessEngineService(options);
}
