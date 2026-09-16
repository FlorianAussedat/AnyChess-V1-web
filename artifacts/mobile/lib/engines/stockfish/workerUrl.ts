/**
 * Stockfish.js main Worker URL builder.
 *
 * Official nmrugg/stockfish.js expects: `<js>#<encoded-wasm-path>`
 * The `,worker` suffix is reserved for internal multithreaded sub-workers —
 * it must NOT appear on the main UCI Worker URL.
 */
import { DEFAULT_STOCKFISH_CONFIG } from './uci.ts';

function readOrigin(): string {
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (typeof origin === 'string') return origin;
  }
  return '';
}

function normalizeJsPath(jsPath: string): string {
  return jsPath.startsWith('/') ? jsPath : `/${jsPath.replace(/^\.\//, '')}`;
}

export function getStockfishWorkerUrl(
  jsPath: string = DEFAULT_STOCKFISH_CONFIG.enginePath,
  wasmPath: string = DEFAULT_STOCKFISH_CONFIG.enginePath.replace(/\.js$/i, '.wasm'),
): string {
  const normalizedJs = normalizeJsPath(jsPath);
  const normalizedWasm = wasmPath.startsWith('/')
    ? wasmPath
    : `/${wasmPath.replace(/^\.\//, '')}`;
  const origin = readOrigin();
  return `${origin}${normalizedJs}#${encodeURIComponent(normalizedWasm)}`;
}

export function resolveStockfishPaths(
  enginePath: string = DEFAULT_STOCKFISH_CONFIG.enginePath,
  origin?: string,
): { jsPath: string; wasmPath: string; workerUrl: string } {
  const jsPath = normalizeJsPath(enginePath);
  const wasmPath = jsPath.replace(/\.js$/i, '.wasm');
  const resolvedOrigin = origin ?? readOrigin();
  const workerUrl = resolvedOrigin
    ? `${resolvedOrigin}${jsPath}#${encodeURIComponent(wasmPath)}`
    : `${jsPath}#${encodeURIComponent(wasmPath)}`;
  return { jsPath, wasmPath, workerUrl };
}

/** @deprecated use getStockfishWorkerUrl */
export const absoluteStockfishWorkerUrl = getStockfishWorkerUrl;
