/**
 * Stockfish.js expects Worker URL: `<js>#<encoded-wasm-url>,worker`
 * See public/engine/stockfish-18-lite-single.js (nmrugg/stockfish.js).
 */
import { DEFAULT_STOCKFISH_CONFIG } from '../stockfish/uci.ts';

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
): { jsPath: string; wasmPath: string; workerUrl: string; workerScriptUrl: string } {
  const jsPath = enginePath.startsWith('/')
    ? enginePath
    : `/${enginePath.replace(/^\.\//, '')}`;
  const wasmPath = jsPath.replace(/\.js$/i, '.wasm');
  const resolvedOrigin = origin ?? readOrigin();
  const wasmUrl = resolvedOrigin ? `${resolvedOrigin}${wasmPath}` : wasmPath;
  const workerScriptUrl = resolvedOrigin ? `${resolvedOrigin}${jsPath}` : jsPath;
  const workerUrl = `${workerScriptUrl}#${encodeURIComponent(wasmUrl)},worker`;
  return { jsPath, wasmPath, workerUrl, workerScriptUrl };
}

/** Absolute worker URL for Expo Web (Worker + WASM fetch from origin). */
export function absoluteStockfishWorkerUrl(
  origin?: string,
  enginePath?: string,
): string {
  const resolvedOrigin = origin ?? readOrigin();
  return resolveStockfishPaths(enginePath, resolvedOrigin ?? undefined).workerUrl;
}
