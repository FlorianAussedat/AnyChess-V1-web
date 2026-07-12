/**
 * Default / native UCI transport.
 *
 * This is the fallback Metro picks on any non-web platform (Android, iOS).
 * There is no local Stockfish transport for native builds *yet* — that is the
 * planned future work: drop in a native engine here (e.g. a JSI binding or a
 * React Native module wrapping a compiled Stockfish) and nothing else in the
 * app needs to change.
 *
 * Today, native builds never construct StockfishEngine (see
 * `engines/index.ts::createOpponentEngine`, which returns the built-in
 * RandomEngine on native), so this stub is not reached at runtime. It exists
 * so the module typechecks and to make the intended extension point explicit.
 */
import type { UciTransport } from './types';

export function createUciTransport(_enginePath: string): UciTransport {
  throw new Error(
    '[StockfishEngine] No local UCI transport is available on this platform yet. ' +
      'The web build runs Stockfish in a Web Worker; a native Android/iOS build ' +
      'must provide its own createUciTransport (native module / JSI) here before ' +
      'StockfishEngine can run natively.',
  );
}
