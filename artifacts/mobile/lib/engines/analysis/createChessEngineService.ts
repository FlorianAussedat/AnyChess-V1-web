/**
 * Native factory — Android G2 wires AnyLyseur to the G1 `UciTransport`
 * (`StockfishUci` process). Callers that inject `createTransport` (tests) win.
 *
 * iOS / Expo Go: no module → factory does not inject a transport → service
 * stays `unavailable` (same as G1). Classic G3a uses `createOpponentEngine()` →
 * StockfishEngine (RandomEngine if native init fails). Endgames (G4) use
 * `SharedStockfishRuntime` on Android. iOS stays unavailable.
 *
 * Web uses `createChessEngineService.web.ts` (Metro platform resolve).
 */
import { Platform } from 'react-native';
import { createUciTransport } from '../stockfish/transport';
import { ChessEngineService } from './ChessEngineService.ts';
import type { ChessEngineServiceOptions } from './types.ts';
import { STOCKFISH_PLATFORM_NOTES } from './types.ts';

export type CreateChessEngineServiceOptions = ChessEngineServiceOptions;

export function createChessEngineService(
  options: CreateChessEngineServiceOptions = {},
): ChessEngineService {
  if (options.createTransport) {
    return new ChessEngineService(options);
  }

  if (Platform.OS === 'android') {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(
        `[createChessEngineService] android | ${STOCKFISH_PLATFORM_NOTES.android.backend}`,
      );
    }
    return new ChessEngineService({
      ...options,
      createTransport: (enginePath: string) => createUciTransport(enginePath),
    });
  }

  return new ChessEngineService(options);
}
