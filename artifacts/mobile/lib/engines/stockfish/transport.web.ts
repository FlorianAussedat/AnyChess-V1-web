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
  let onLine: ((line: string) => void) | null = null;

  const deliver = (raw: string) => {
    if (!onLine) return;
    for (const part of raw.split(/\r?\n/)) {
      const line = part.trim();
      if (line) onLine(line);
    }
  };

  return {
    start(lineHandler: (line: string) => void): Promise<void> {
      onLine = lineHandler;
      return new Promise((resolve, reject) => {
        try {
          worker = new Worker(enginePath);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          options.onWorkerError?.(msg);
          reject(new Error(`[Stockfish] Worker failed: ${msg}`));
          return;
        }

        let settled = false;
        const settleReady = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        worker.onmessage = (event: MessageEvent) => {
          settleReady();
          const raw =
            typeof event.data === 'string'
              ? event.data
              : String(event.data ?? '');
          deliver(raw);
        };

        worker.onerror = (event: ErrorEvent) => {
          const msg = event.message || 'Worker error';
          console.error('[Stockfish] worker error:', msg, event.filename, event.lineno);
          options.onWorkerError?.(msg);
          if (!settled) {
            settled = true;
            reject(new Error(`[Stockfish] Worker error: ${msg}`));
          }
        };

        worker.onmessageerror = () => {
          options.onWorkerError?.('Worker message error');
        };

        // Allow worker script fetch/parse before the main thread sends UCI.
        setTimeout(settleReady, 300);
      });
    },

    send(command: string): void {
      worker?.postMessage(command);
    },

    terminate(): void {
      try {
        worker?.terminate();
      } finally {
        worker = null;
        onLine = null;
      }
    },
  };
}
