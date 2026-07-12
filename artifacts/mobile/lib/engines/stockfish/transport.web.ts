/**
 * Web transport: runs Stockfish (WASM) in a dedicated Web Worker so all
 * engine calculation happens off the main/UI thread. This keeps the interface
 * responsive and — crucially for this app — never blocks the microphone
 * listener, speech synthesis, or board updates while the engine thinks.
 *
 * Metro resolves this file (over `transport.ts`) automatically on the web
 * platform. The worker script and its `.wasm` sibling are served from
 * `public/engine/`; the worker loads the `.wasm` from its own directory.
 */
import type { UciTransport } from './types';

export function createUciTransport(enginePath: string): UciTransport {
  let worker: Worker | null = null;

  return {
    start(onLine: (line: string) => void): Promise<void> {
      worker = new Worker(enginePath);
      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;
        const line = typeof data === 'string' ? data : String(data ?? '');
        if (line) onLine(line);
      };
      worker.onerror = (event: ErrorEvent) => {
        // Non-fatal: surface for debugging but let the engine promise time out
        // / the caller fall back gracefully.
        console.error('[Stockfish] worker error:', event.message);
      };
      // Worker creation is synchronous; UCI readiness is tracked separately by
      // StockfishEngine via the uciok/readyok handshake.
      return Promise.resolve();
    },

    send(command: string): void {
      worker?.postMessage(command);
    },

    terminate(): void {
      try {
        worker?.terminate();
      } finally {
        worker = null;
      }
    },
  };
}
