/**
 * Web transport: Stockfish WASM in a dedicated Web Worker.
 *
 * Metro resolves this over `transport.ts` on web.
 * Worker script + `.wasm` are served from `public/engine/`.
 */
import type { UciTransport } from './types';

export type WebTransportOptions = {
  onWorkerError?: (message: string) => void;
};

export function createUciTransport(
  enginePath: string,
  options: WebTransportOptions = {},
): UciTransport {
  let worker: Worker | null = null;

  return {
    start(onLine: (line: string) => void): Promise<void> {
      try {
        worker = new Worker(enginePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        options.onWorkerError?.(msg);
        return Promise.reject(new Error(`[Stockfish] Worker failed: ${msg}`));
      }

      worker.onmessage = (event: MessageEvent) => {
        const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
        for (const part of raw.split(/\r?\n/)) {
          const line = part.trim();
          if (line) onLine(line);
        }
      };

      worker.onerror = (event: ErrorEvent) => {
        const msg = event.message || 'Worker error';
        console.error('[Stockfish] worker error:', msg, event.filename, event.lineno);
        options.onWorkerError?.(msg);
      };

      worker.onmessageerror = () => {
        options.onWorkerError?.('Worker message error');
      };

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
