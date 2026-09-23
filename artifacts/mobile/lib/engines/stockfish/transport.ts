/**
 * Native (Android / iOS) UCI transport.
 *
 * Metro resolves this file on non-web platforms. Web keeps `transport.web.ts`
 * (WASM Worker) and never imports this module.
 *
 * G2: Android talks to the local `StockfishUci` Expo module (official Stockfish 19
 * process). AnyLyseur binds this transport via `createChessEngineService`.
 * G3a Classic uses the same transport via `createOpponentEngine` → StockfishEngine.
 * iOS still has no binary. Endgames (`SharedStockfishRuntime`) stay unwired.
 */
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import {
  createNativeUciTransport,
  type NativeStockfishBridge,
} from './nativeUciTransport';
import type { UciTransport } from './types';

function getAndroidBridge(): NativeStockfishBridge | null {
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<NativeStockfishBridge>('StockfishUci');
}

function attachBackgroundTerminate(transport: UciTransport): UciTransport {
  let sub: { remove(): void } | null = null;
  const originalTerminate = transport.terminate.bind(transport);
  const terminate = () => {
    if (sub) {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
      sub = null;
    }
    originalTerminate();
  };

  const originalStart = transport.start.bind(transport);
  return {
    start(onLine) {
      if (!sub) {
        sub = AppState.addEventListener('change', (state) => {
          if (state === 'background') terminate();
        });
      }
      return originalStart(onLine);
    },
    send: transport.send.bind(transport),
    terminate,
  };
}

export function createUciTransport(_enginePath: string): UciTransport {
  if (Platform.OS === 'android') {
    const bridge = getAndroidBridge();
    if (!bridge) {
      throw new Error(
        '[StockfishEngine] Native StockfishUci module is unavailable. ' +
          'This requires an Android Development Build (not Expo Go).',
      );
    }
    return attachBackgroundTerminate(createNativeUciTransport(bridge));
  }

  throw new Error(
    '[StockfishEngine] No local UCI transport is available on this platform yet. ' +
      'Android G1 uses the StockfishUci native module; iOS is not bundled.',
  );
}
