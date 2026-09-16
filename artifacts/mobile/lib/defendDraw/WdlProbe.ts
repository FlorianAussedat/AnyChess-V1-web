/**
 * Tablebase-first WDL probe with heuristic / Stockfish fallback.
 * Also exposes tablebase move lists for opponent pressure selection.
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
  fetchImpl?: typeof fetch;
  tablebaseTimeoutMs?: number;
  stockfishEval?: StockfishEvalFn;
  disableTablebase?: boolean;
};

export type TablebaseMove = {
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  category: string;
  verdict: WdlVerdict;
  wdl?: number;
};

function mapLichessCategory(category: string | undefined): WdlVerdict | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c === 'draw' || c === 'blessed-loss' || c === 'cursed-win') return 'draw';
  if (c === 'win' || c === 'maybe-win') return 'win';
  if (c === 'loss' || c === 'maybe-loss') return 'loss';
  return null;
}

function parseUci(uci: string): {
  from: string;
  to: string;
  promotion?: string;
} | null {
  if (!uci || uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4]!.toLowerCase() : undefined,
  };
}

function terminalVerdict(game: Chess): WdlProbeResult | null {
  if (game.isCheckmate()) {
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
 * Offline heuristic when tablebase / engine unavailable.
 * Does NOT treat every low-piece ending as a useful draw exercise —
 * only clear terminal / insufficient-material cases.
 */
export function heuristicWdl(fen: string): WdlProbeResult {
  const game = new Chess(fen);
  const terminal = terminalVerdict(game);
  if (terminal) return terminal;
  if (game.isInsufficientMaterial()) {
    return { verdict: 'draw', source: 'heuristic' };
  }
  // Unknown otherwise — never invent "draw" for tense endings offline.
  void pieceCount(game);
  return { verdict: 'unknown', source: 'heuristic' };
}

async function fetchTablebaseJson(
  fen: string,
  options: WdlProbeOptions,
): Promise<{
  category?: string;
  wdl?: number | null;
  moves?: Array<{
    uci?: string;
    category?: string;
    wdl?: number | null;
  }>;
} | null> {
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
    const res = await fetchImpl(url, { signal: controller?.signal });
    if (!res.ok) return null;
    return (await res.json()) as {
      category?: string;
      wdl?: number | null;
      moves?: Array<{ uci?: string; category?: string; wdl?: number | null }>;
    };
  } catch {
    return null;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

function resultFromTablebaseData(data: {
  category?: string;
  wdl?: number | null;
}): WdlProbeResult | null {
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
}

export async function probeWdl(
  fen: string,
  options: WdlProbeOptions = {},
): Promise<WdlProbeResult> {
  const game = new Chess(fen);
  const terminal = terminalVerdict(game);
  if (terminal) return terminal;

  const data = await fetchTablebaseJson(fen, options);
  if (data) {
    const tb = resultFromTablebaseData(data);
    if (tb) return tb;
  }

  if (options.stockfishEval) {
    try {
      const cp = await options.stockfishEval(fen);
      if (cp != null && Number.isFinite(cp)) {
        return { verdict: verdictFromCp(cp), source: 'stockfish' };
      }
    } catch {
      /* fall through */
    }
  }

  return heuristicWdl(fen);
}

export async function probeWdlForPlayer(
  fen: string,
  playerColor: 'w' | 'b',
  options: WdlProbeOptions = {},
): Promise<WdlProbeResult> {
  const stm = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const raw = await probeWdl(fen, options);
  if (stm === playerColor) return raw;
  return { ...raw, verdict: invertVerdict(raw.verdict) };
}

/**
 * Tablebase legal moves with WDL categories (STM perspective).
 * Empty when TB unavailable.
 */
export async function probeTablebaseMoves(
  fen: string,
  options: WdlProbeOptions = {},
): Promise<TablebaseMove[]> {
  const data = await fetchTablebaseJson(fen, options);
  if (!data?.moves?.length) return [];
  const out: TablebaseMove[] = [];
  for (const m of data.moves) {
    if (!m.uci) continue;
    const parsed = parseUci(m.uci);
    if (!parsed) continue;
    const verdict =
      mapLichessCategory(m.category) ??
      (typeof m.wdl === 'number'
        ? m.wdl > 0
          ? 'win'
          : m.wdl < 0
            ? 'loss'
            : 'draw'
        : 'unknown');
    out.push({
      uci: m.uci,
      from: parsed.from,
      to: parsed.to,
      promotion: parsed.promotion,
      category: m.category ?? '',
      verdict,
      wdl: typeof m.wdl === 'number' ? m.wdl : undefined,
    });
  }
  return out;
}

/** Count how many STM moves preserve DRAW according to tablebase. */
export async function countDrawingMoves(
  fen: string,
  options: WdlProbeOptions = {},
): Promise<{ legal: number; drawing: number; source: 'tablebase' | 'none' }> {
  const game = new Chess(fen);
  const legal = game.moves().length;
  const moves = await probeTablebaseMoves(fen, options);
  if (!moves.length) return { legal, drawing: -1, source: 'none' };
  const drawing = moves.filter((m) => m.verdict === 'draw').length;
  return { legal, drawing, source: 'tablebase' };
}
