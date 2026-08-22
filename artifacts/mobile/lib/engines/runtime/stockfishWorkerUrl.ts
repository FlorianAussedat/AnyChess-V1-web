/**
 * Stockfish.js expects Worker URL: `<js>#<encoded-wasm-path>,worker`
 * See public/engine/stockfish-18-lite-single.js (nmrugg/stockfish.js).
 */
import { DEFAULT_STOCKFISH_CONFIG } from '../stockfish/uci.ts';

export function resolveStockfishPaths(
  enginePath: string = DEFAULT_STOCKFISH_CONFIG.enginePath,
): { jsPath: string; wasmPath: string; workerUrl: string } {
  const jsPath = enginePath.startsWith('/')
    ? enginePath
    : `/${enginePath.replace(/^\.\//, '')}`;
  const wasmPath = jsPath.replace(/\.js$/i, '.wasm');
  const workerUrl = `${jsPath}#${encodeURIComponent(wasmPath)},worker`;
  return { jsPath, wasmPath, workerUrl };
}

/** Absolute worker URL for Expo Web (Worker resolves relative to origin). */
export function absoluteStockfishWorkerUrl(
  origin?: string,
  enginePath?: string,
): string {
  const { workerUrl } = resolveStockfishPaths(enginePath);
  if (typeof origin === 'string' && origin.length > 0) {
    return `${origin.replace(/\/$/, '')}${workerUrl}`;
  }
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin) {
      return `${loc.origin}${workerUrl}`;
    }
  }
  return workerUrl;
}
