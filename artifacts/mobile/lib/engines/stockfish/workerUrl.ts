/**
 * Stockfish.js Worker URL builder.
 *
 * stockfish.js enters WASM worker mode when the Worker URL hash ends with
 * `,worker` — without it the IIFE may run the wrong branch and never boot.
 *
 * Format: `<origin>/engine/stockfish-18-lite-single.js#<encoded-wasm-path>,worker`
 */
import { DEFAULT_STOCKFISH_CONFIG } from './uci.ts';

function readOrigin(): string | null {
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin) return loc.origin;
  }
  return null;
}

export function resolveStockfishPaths(
  enginePath: string = DEFAULT_STOCKFISH_CONFIG.enginePath,
  origin?: string,
): { jsPath: string; wasmPath: string; workerUrl: string } {
  const jsPath = enginePath.startsWith('/')
    ? enginePath
    : `/${enginePath.replace(/^\.\//, '')}`;
  const wasmPath = jsPath.replace(/\.js$/i, '.wasm');
  const resolvedOrigin = origin ?? readOrigin();
  // Relative WASM path — resolved from worker origin (same host as the JS).
  const workerScriptUrl = resolvedOrigin ? `${resolvedOrigin}${jsPath}` : jsPath;
  const workerUrl = `${workerScriptUrl}#${encodeURIComponent(wasmPath)},worker`;
  return { jsPath, wasmPath, workerUrl };
}

/** Worker URL for the current page origin (Expo Web). */
export function getStockfishWorkerUrl(
  origin?: string,
  enginePath?: string,
): string {
  return resolveStockfishPaths(enginePath, origin).workerUrl;
}

/** @deprecated use getStockfishWorkerUrl */
export const absoluteStockfishWorkerUrl = getStockfishWorkerUrl;
