/**
 * Authoring helper: walk Syzygy to measure drawing vs losing replies.
 * Does not assign difficulty — report only.
 */
import { Chess } from 'chess.js';

const LICHESS_TABLEBASE = 'https://tablebase.lichess.ovh/standard?fen=';

export type DrawWalkMetrics = {
  legalMoves: number;
  drawingMoves: number;
  losingMoves: number;
  drawingRatio: number;
  /** Defender plies (including start) with ≤2 drawing replies, along one drawing PV. */
  criticalMoves: number;
  /** Defender plies where exactly one move holds the draw. */
  uniqueMoveMoments: number;
};

function mapCat(category: string | undefined): 'draw' | 'win' | 'loss' | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c === 'draw' || c === 'blessed-loss' || c === 'cursed-win') return 'draw';
  if (c === 'win' || c === 'maybe-win') return 'win';
  if (c === 'loss' || c === 'maybe-loss') return 'loss';
  return null;
}

export type TablebaseJson = {
  category?: string;
  moves?: Array<{ uci?: string; category?: string }>;
};

export type AnalyzeFetch = (fen: string) => Promise<TablebaseJson | null>;

async function defaultFetch(fen: string): Promise<TablebaseJson | null> {
  try {
    const res = await fetch(`${LICHESS_TABLEBASE}${encodeURIComponent(fen)}`);
    if (!res.ok) return null;
    return (await res.json()) as TablebaseJson;
  } catch {
    return null;
  }
}

function applyUci(fen: string, uci: string): string | null {
  const g = new Chess(fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  try {
    g.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
    return g.fen();
  } catch {
    return null;
  }
}

function countMoments(
  drawingCount: number,
  critical: { criticalMoves: number; uniqueMoveMoments: number },
): void {
  if (drawingCount === 1) critical.uniqueMoveMoments += 1;
  if (drawingCount > 0 && drawingCount <= 2) critical.criticalMoves += 1;
}

/**
 * Count drawing/losing STM moves, then walk up to `plyDepth` drawing replies
 * (and a typical opponent reply) to count successive "critical" defender decisions.
 */
export async function analyzeDrawingWalk(
  fen: string,
  options: { plyDepth?: number; fetchTb?: AnalyzeFetch; pauseMs?: number } = {},
): Promise<DrawWalkMetrics | null> {
  const fetchTb = options.fetchTb ?? defaultFetch;
  const plyDepth = options.plyDepth ?? 4;
  const pauseMs = options.pauseMs ?? 80;

  const root = await fetchTb(fen);
  if (!root?.moves?.length) return null;

  const legalMoves = root.moves.length;
  const drawingMoves = root.moves.filter((m) => mapCat(m.category) === 'draw').length;
  const losingMoves = legalMoves - drawingMoves;
  const drawingRatio = legalMoves > 0 ? drawingMoves / legalMoves : 0;

  const critical = { criticalMoves: 0, uniqueMoveMoments: 0 };
  countMoments(drawingMoves, critical);

  let currentFen = fen;
  let drawingUcis = root.moves
    .filter((m) => mapCat(m.category) === 'draw' && m.uci)
    .map((m) => m.uci!);

  for (let ply = 1; ply < plyDepth && drawingUcis.length > 0; ply++) {
    const nextFen = applyUci(currentFen, drawingUcis[0]!);
    if (!nextFen) break;
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    const afterDef = await fetchTb(nextFen);
    const oppMoves = afterDef?.moves ?? [];
    const oppPick =
      oppMoves.find((m) => mapCat(m.category) === 'win' && m.uci)?.uci ??
      oppMoves.find((m) => mapCat(m.category) === 'draw' && m.uci)?.uci ??
      oppMoves[0]?.uci;
    if (!oppPick) break;
    const afterOpp = applyUci(nextFen, oppPick);
    if (!afterOpp) break;
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    const nextRoot = await fetchTb(afterOpp);
    if (!nextRoot?.moves?.length) break;
    drawingUcis = nextRoot.moves
      .filter((m) => mapCat(m.category) === 'draw' && m.uci)
      .map((m) => m.uci!);
    countMoments(drawingUcis.length, critical);
    currentFen = afterOpp;
  }

  return {
    legalMoves,
    drawingMoves,
    losingMoves,
    drawingRatio,
    criticalMoves: critical.criticalMoves,
    uniqueMoveMoments: critical.uniqueMoveMoments,
  };
}
