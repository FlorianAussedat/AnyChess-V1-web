/**
 * Native / default factory — no Stockfish UCI transport yet.
 * Status stays `unavailable` (no random-move substitute).
 *
 * A future native module must implement `createUciTransport` in
 * `lib/engines/stockfish/transport.ts` and pass it via options (Dev Client /
 * prebuild; Expo Go cannot load custom native engines).
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
