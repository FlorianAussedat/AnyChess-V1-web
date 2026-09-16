/**
 * Authoring-time position certification (Syzygy first, Stockfish fallback).
 * Used by the dataset script and unit tests — NOT by runtime gameplay.
 */
import { Chess } from 'chess.js';
import {
  STOCKFISH_CERT_ENGINE_LABEL,
  STOCKFISH_CERT_MAX_ABS_CP,
  STOCKFISH_CERT_MIN_DEPTH,
  SYZYGY_MAX_PIECES,
  type DefendDrawVerification,
} from './certification.ts';
import {
  isStructurallyTrivialDefendDraw,
  isTrivialDefendDrawPosition,
} from './defensivePrecision.ts';
import { validateDefendDrawFen } from './fenValidation.ts';

const LICHESS_TABLEBASE = 'https://tablebase.lichess.ovh/standard?fen=';

export type CertifyBaseInput = {
  id: string;
  fen: string;
  defenderColor: 'w' | 'b';
  legalMoves: number;
  drawingMoves: number;
};

export type StockfishCertAnalysis = {
  depth: number;
  scoreCp: number;
  mateIn: number | null;
  wdl?: { win: number; draw: number; loss: number } | null;
};

export type CertifyPositionOptions = {
  fetchImpl?: typeof fetch;
  tablebaseTimeoutMs?: number;
  /** Injected Stockfish analysis (tests / local engine runner). */
  stockfishAnalyze?: (fen: string) => Promise<StockfishCertAnalysis>;
  stockfishMinDepth?: number;
  stockfishMaxAbsCp?: number;
  stockfishEngineLabel?: string;
  /** When false, positions >7 pieces (or TB miss) are rejected instead of SF. */
  allowStockfishFallback?: boolean;
};

export type CertifyPositionResult =
  | {
      ok: true;
      verification: DefendDrawVerification;
      legalMoves: number;
      drawingMoves: number;
    }
  | { ok: false; reason: string };

function pieceCount(fen: string): number {
  return new Chess(fen).board().flat().filter(Boolean).length;
}

function mapTbCategory(category: string | undefined): 'draw' | 'win' | 'loss' | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c === 'draw' || c === 'blessed-loss' || c === 'cursed-win') return 'draw';
  if (c === 'win' || c === 'maybe-win') return 'win';
  if (c === 'loss' || c === 'maybe-loss') return 'loss';
  return null;
}

async function fetchSyzygy(
  fen: string,
  options: CertifyPositionOptions,
): Promise<{
  category?: string;
  moves?: Array<{ category?: string }>;
} | null> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = options.tablebaseTimeoutMs ?? 8_000;
  const timer =
    controller != null ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const url = `${LICHESS_TABLEBASE}${encodeURIComponent(fen)}`;
    const res = await fetchImpl(url, { signal: controller?.signal });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text) as {
        category?: string;
        moves?: Array<{ category?: string }>;
      };
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

function countTbDrawingMoves(
  data: { moves?: Array<{ category?: string }> },
  legalFallback: number,
): { legal: number; drawing: number } {
  const moves = data.moves ?? [];
  if (moves.length === 0) {
    return { legal: legalFallback, drawing: -1 };
  }
  const drawing = moves.filter(
    (m) => mapTbCategory(m.category) === 'draw',
  ).length;
  return { legal: moves.length, drawing };
}

/**
 * Structural gates shared with runtime selection (FEN + material/pressure).
 */
export function validateDefendDrawBase(input: CertifyBaseInput): {
  ok: true;
  legal: number;
} | { ok: false; reason: string } {
  const fenCheck = validateDefendDrawFen(input.fen, input.defenderColor);
  if (!fenCheck.ok) {
    return { ok: false, reason: `invalid FEN: ${fenCheck.reason}` };
  }
  const legal = fenCheck.game.moves().length;
  if (legal <= 0) {
    return { ok: false, reason: 'no legal moves' };
  }
  if (isStructurallyTrivialDefendDraw(input.fen, input.defenderColor)) {
    return { ok: false, reason: 'trivial / no practical pressure' };
  }
  return { ok: true, legal };
}

function certifyWithStockfishAnalysis(
  analysis: StockfishCertAnalysis,
  options: CertifyPositionOptions,
): CertifyPositionResult {
  const minDepth = options.stockfishMinDepth ?? STOCKFISH_CERT_MIN_DEPTH;
  const maxAbsCp = options.stockfishMaxAbsCp ?? STOCKFISH_CERT_MAX_ABS_CP;
  if (analysis.mateIn != null && analysis.mateIn !== 0) {
    return { ok: false, reason: `stockfish mate-in ${analysis.mateIn}` };
  }
  if (analysis.depth < minDepth) {
    return {
      ok: false,
      reason: `stockfish depth ${analysis.depth} < ${minDepth}`,
    };
  }
  if (Math.abs(analysis.scoreCp) > maxAbsCp) {
    return {
      ok: false,
      reason: `stockfish |cp|=${Math.abs(analysis.scoreCp)} > ${maxAbsCp}`,
    };
  }
  // Prefer WDL when present: require dominant draw mass.
  if (analysis.wdl) {
    if (analysis.wdl.draw < 700) {
      return {
        ok: false,
        reason: `stockfish WDL draw=${analysis.wdl.draw} < 700`,
      };
    }
  }
  return {
    ok: true,
    verification: {
      method: 'stockfish',
      result: 'draw',
      engine: options.stockfishEngineLabel ?? STOCKFISH_CERT_ENGINE_LABEL,
      depth: analysis.depth,
      maxAbsCp,
    },
    legalMoves: 0,
    drawingMoves: 0,
  };
}

/**
 * Certify one position. Syzygy (≤7) wins over Stockfish when available.
 */
export async function certifyDefendDrawPosition(
  input: CertifyBaseInput,
  options: CertifyPositionOptions = {},
): Promise<CertifyPositionResult> {
  const base = validateDefendDrawBase(input);
  if (!base.ok) return base;

  const pieces = pieceCount(input.fen);
  const allowSf = options.allowStockfishFallback !== false;

  if (pieces <= SYZYGY_MAX_PIECES) {
    const tb = await fetchSyzygy(input.fen, options);
    if (tb) {
      const mapped = mapTbCategory(tb.category);
      if (mapped === 'win') {
        return { ok: false, reason: 'syzygy result is win (not draw)' };
      }
      if (mapped === 'loss') {
        return { ok: false, reason: 'syzygy result is loss (not draw)' };
      }
      if (mapped === 'draw') {
        const counts = countTbDrawingMoves(tb, base.legal);
        const legalMoves = counts.legal > 0 ? counts.legal : base.legal;
        const drawingMoves =
          counts.drawing >= 0 ? counts.drawing : input.drawingMoves;
        if (drawingMoves <= 0) {
          return {
            ok: false,
            reason: 'syzygy draw but no drawing move for STM',
          };
        }
        if (
          isTrivialDefendDrawPosition({
            fen: input.fen,
            defenderColor: input.defenderColor,
            legalMoves,
            drawingMoves,
          })
        ) {
          return {
            ok: false,
            reason: 'syzygy draw but hold is trivial (no exercise)',
          };
        }
        return {
          ok: true,
          verification: { method: 'syzygy', result: 'draw' },
          legalMoves,
          drawingMoves,
        };
      }
    }
    // TB unavailable / unknown — optional Stockfish fallback
    if (!allowSf || !options.stockfishAnalyze) {
      return {
        ok: false,
        reason:
          pieces <= SYZYGY_MAX_PIECES
            ? 'syzygy unavailable or inconclusive; no stockfish fallback'
            : 'no certification method',
      };
    }
  }

  if (!allowSf || !options.stockfishAnalyze) {
    return {
      ok: false,
      reason:
        pieces > SYZYGY_MAX_PIECES
          ? `>${SYZYGY_MAX_PIECES} pieces require stockfishAnalyze`
          : 'no certification method',
    };
  }

  const analysis = await options.stockfishAnalyze(input.fen);
  const sf = certifyWithStockfishAnalysis(analysis, options);
  if (!sf.ok) return sf;
  return {
    ...sf,
    legalMoves: base.legal,
    drawingMoves: input.drawingMoves > 0 ? input.drawingMoves : 1,
  };
}
