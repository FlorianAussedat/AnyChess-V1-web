/**
 * Shared analysis-engine types (platform-agnostic).
 * UI / DefendDraw talk to these — never to WASM, Workers, or raw UCI.
 */

export type EngineStatus =
  | 'uninitialized'
  | 'loading'
  | 'ready'
  | 'thinking'
  | 'error'
  | 'unavailable';

export type EngineScore = {
  type: 'cp' | 'mate';
  /** cp: centipawns for STM; mate: positive = STM mates in N, negative = STM mated in N. */
  value: number;
};

export type EngineWdl = {
  /** Permille (0–1000) for side-to-move. */
  win: number;
  draw: number;
  loss: number;
};

export type EngineBestMove = {
  from: string;
  to: string;
  promotion?: string;
  /** Raw UCI token when available (e.g. "e2e4", "e7e8q"). */
  uci?: string;
};

/** Common analysis payload — independent of web/native transport. */
export type EngineAnalysisLine = {
  multipv: number;
  scoreCp: number;
  mateIn: number | null;
  wdl: EngineWdl | null;
  depth: number;
  bestMove: EngineBestMove | null;
  /** Full principal variation in UCI (empty when unavailable). */
  pv: string[];
};

export type EngineAnalysis = {
  bestMove: EngineBestMove | null;
  ponder?: EngineBestMove | null;
  score: EngineScore | null;
  /** Convenience: centipawns for STM (mates mapped to large magnitude). */
  scoreCp: number;
  /** Mate distance for STM, or null. */
  mateIn: number | null;
  wdl: EngineWdl | null;
  depth: number;
  /** MultiPV candidate lines when requested (rank 1 first). Empty if unavailable. */
  lines?: EngineAnalysisLine[];
  /**
   * True when the search was stopped / superseded before a usable result.
   * Callers must not treat this as a complete analysis (no fake 0.00 eval).
   */
  cancelled?: boolean;
};

export type AnalyzePositionOptions = {
  fen: string;
  depth?: number;
  movetimeMs?: number;
  /** Request MultiPV candidates (1 = classic single best). */
  multiPv?: number;
};

export type ChessEngineServiceOptions = {
  enginePath?: string;
  /** Default think time when callers omit movetimeMs. */
  moveTimeMs?: number;
  bootTimeoutMs?: number;
  /** Safety timeout per analysis (ms). */
  analysisTimeoutMs?: number;
  /**
   * Inject transport factory (tests). Defaults to platform `createUciTransport`.
   * Must be a real UCI channel — never a random-move opponent.
   */
  createTransport?: (enginePath: string) => import('../stockfish/types').UciTransport;
};

/**
 * Platform Stockfish availability — single source of truth for product copy.
 *
 * Web preview: Stockfish 18 lite single-thread WASM in a Web Worker (`public/engine/`).
 * Android / iOS / Expo Go: no native UCI transport yet (`transport.ts` throws).
 * A future native Stockfish needs a Dev Client / prebuild + real `createUciTransport`
 * in `lib/engines/stockfish/transport.ts` — Expo Go cannot load custom native modules.
 */
export const STOCKFISH_PLATFORM_NOTES = {
  web: {
    available: true as const,
    backend: 'stockfish-18-lite-single.wasm (Web Worker)',
  },
  android: {
    available: false as const,
    backend: null,
    requires:
      'Custom Dev Client / prebuild with a native Stockfish UCI module wired in transport.ts',
  },
  ios: {
    available: false as const,
    backend: null,
    requires:
      'Custom Dev Client / prebuild with a native Stockfish UCI module wired in transport.ts',
  },
  expoGo: {
    supportsStockfish: false as const,
    reason:
      'Expo Go cannot ship a custom native Stockfish module; web WASM works only on Platform.OS === "web".',
  },
} as const;
