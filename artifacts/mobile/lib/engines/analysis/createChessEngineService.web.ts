/**
 * Web factory — binds Stockfish WASM Worker transport.
 * Metro resolves this file over `createChessEngineService.ts` on web.
 */
import { createUciTransport as createWebUciTransport } from '../stockfish/transport';
import { ChessEngineService } from './ChessEngineService.ts';
import type { ChessEngineServiceOptions } from './types.ts';
import { STOCKFISH_PLATFORM_NOTES } from './types.ts';

export type CreateChessEngineServiceOptions = ChessEngineServiceOptions;

export function createChessEngineService(
  options: CreateChessEngineServiceOptions = {},
): ChessEngineService {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      `[createChessEngineService] web | ${STOCKFISH_PLATFORM_NOTES.web.backend}`,
    );
  }
  return new ChessEngineService({
    ...options,
    createTransport:
      options.createTransport ??
      ((enginePath: string) => createWebUciTransport(enginePath)),
  });
}
