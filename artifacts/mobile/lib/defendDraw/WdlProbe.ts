/**
 * Tablebase-first WDL probe with heuristic / injectable Stockfish fallback.
 */
import { Chess } from 'chess.js';
import {
  invertVerdict,
  verdictFromCp,
  type WdlProbeResult,
  type WdlVerdict,
} from './wdl.ts';

const LICHESS_TABLEBASE =
  'https://tablebase.lichess.ovh/standard?fen=';

export type StockfishEvalFn = (fen: string) => Promise<number | null>;

export type WdlProbeOptions = {
  /** Override fetch (tests / offline). */
  fetchImpl?: typeof fetch;
  /** Timeout for tablebase HTTP. */
  tablebaseTimeoutMs?: number;
  /** Optional Stockfish (or other) centipawn eval, side-to-move. */
  stockfishEval?: StockfishEvalFn;
  /** Skip network tablebase. */
  disableTablebase?: boolean;
};

function terminalVerdict(game: Chess): WdlProbeResult | null {
  if (game.isCheckmate()) {
    // Side to move is mated → loss for STM.
    return { verdict: 'loss', source: 'terminal' };
  }
  if (
    game.isStalemate() ||
    game.isInsufficientMaterial() ||
    game.isThreefoldRepetition() ||
    game.isDraw()
  ) {
    return { verdict: 'draw', source: 'terminal' };
  }
  return null;
}

function pieceCount(game: Chess): number {
  return game.board().flat().filter(Boolean).length;
}

/**
 * Very coarse offline heuristic when tablebase / engine are unavailable.
 * Prefers "draw" in elementary low-material endings; otherwise unknown.
 */
export function heuristicWdl(fen: string): WdlProbeResult {
  const game = new Chess(fen);
  const terminal = terminalVerdict(game);
  if (terminal) return terminal;

  const n = pieceCount(game);
  if (game.isInsufficientMaterial()) {
    return { verdict: 'draw', source: 'heuristic' };
  }

  // K vs K, KB vs K, KN vs K, KNN vs K are draws with correct play.
  if (n <= 3) {
    return { verdict: 'draw', source: 'heuristic' };
  }
  if (n === 4) {
    const fenParts = fen.split(' ');
    const board = fenParts[0] ?? '';
    const hasQueenOrRook = /[qrQR]/.test(board);
    if (!hasQueenOrRook) {
      return { verdict: 'draw', source: 'heuristic' };
    }
  }

  return { verdict: 'unknown', source: 'heuristic' };
}

function mapLichessCategory(category: string | undefined): WdlVerdict | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c === 'draw' || c === 'blessed-loss' || c === 'cursed-win') return 'draw';
  if (c === 'win' || c === 'maybe-win') return 'win';
  if (c === 'loss' || c === 'maybe-loss') return 'loss';
  return null;
}

async function probeTablebase(
  fen: string,
  options: WdlProbeOptions,
): Promise<WdlProbeResult | null> {
  if (options.disableTablebase) return null;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = options.tablebaseTimeoutMs ?? 2500;
  const timer =
    controller != null
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const url = `${LICHESS_TABLEBASE}${encodeURIComponent(fen)}`;
    const res = await fetchImpl(url, {
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      category?: string;
      wdl?: number | null;
    };
    const fromCat = mapLichessCategory(data.category);
    if (fromCat) {
      return {
        verdict: fromCat,
        source: 'tablebase',
        wdl: typeof data.wdl === 'number' ? data.wdl : undefined,
      };
    }
    if (typeof data.wdl === 'number') {
      const verdict: WdlVerdict =
        data.wdl > 0 ? 'win' : data.wdl < 0 ? 'loss' : 'draw';
      return { verdict, source: 'tablebase', wdl: data.wdl };
    }
    return null;
  } catch {
    return null;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

/**
 * Probe WDL for `fen` (side-to-move perspective).
 * Order: terminal → tablebase → Stockfish cp → heuristic.
 */
export async function probeWdl(
  fen: string,
  options: WdlProbeOptions = {},
): Promise<WdlProbeResult> {
  const game = new Chess(fen);
  const terminal = terminalVerdict(game);
  if (terminal) return terminal;

  const tb = await probeTablebase(fen, options);
  if (tb) return tb;

  if (options.stockfishEval) {
    try {
      const cp = await options.stockfishEval(fen);
      if (cp != null && Number.isFinite(cp)) {
        return {
          verdict: verdictFromCp(cp),
          source: 'stockfish',
        };
      }
    } catch {
      /* fall through */
    }
  }

  return heuristicWdl(fen);
}

/** WDL from a specific player's color perspective. */
export async function probeWdlForPlayer(
  fen: string,
  playerColor: 'w' | 'b',
  options: WdlProbeOptions = {},
): Promise<WdlProbeResult> {
  const stm = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const raw = await probeWdl(fen, options);
  if (stm === playerColor) return raw;
  return {
    ...raw,
    verdict: invertVerdict(raw.verdict),
  };
}
