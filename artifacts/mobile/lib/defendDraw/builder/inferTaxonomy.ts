import { Chess } from 'chess.js';
import type { EndgameConcept, EndgameFamily } from '../taxonomy.ts';
import type { DrawWalkMetrics } from '../analyzeDifficulty.ts';
import { pieceCount } from './fenUtils.ts';

type Piece = { type: string; color: 'w' | 'b' };

function pieces(fen: string): Piece[] {
  return new Chess(fen).board().flat().filter(Boolean) as Piece[];
}

function hasType(fen: string, type: string, color?: 'w' | 'b'): boolean {
  return pieces(fen).some(
    (p) => p.type === type && (color == null || p.color === color),
  );
}

function pawnCount(fen: string): number {
  return pieces(fen).filter((p) => p.type === 'p').length;
}

/** Infer endgame family from material — not shown in UI. */
export function inferEndgameFamily(fen: string): EndgameFamily {
  const ps = pieces(fen);
  const types = new Set(ps.map((p) => p.type));
  const rooks = ps.filter((p) => p.type === 'r').length;
  const queens = ps.filter((p) => p.type === 'q').length;
  const minors = ps.filter((p) => p.type === 'n' || p.type === 'b').length;
  const pawns = ps.filter((p) => p.type === 'p').length;

  if (queens >= 1 && rooks >= 1 && queens + rooks >= 2) {
    const qOnly = queens >= 1 && rooks >= 1;
    if (qOnly && pawns === 0) return 'imbalanced';
  }
  if (queens >= 1 && rooks >= 1) return 'imbalanced';
  if (
    (queens === 1 && rooks === 0 && minors === 0 && pawns === 0) ||
    (rooks === 1 && queens === 1)
  ) {
    return 'imbalanced';
  }
  if (types.has('q') && types.has('r') && !types.has('p')) return 'imbalanced';
  if (
    minors >= 2 &&
    types.has('b') &&
    pieces(fen).filter((p) => p.type === 'b').length === 2 &&
    pawns > 0
  ) {
    const bishops = ps.filter((p) => p.type === 'b');
    if (bishops[0]!.color !== bishops[1]!.color) return 'fortress';
  }
  if (types.has('r') && !types.has('q') && !types.has('n') && !types.has('b')) {
    return 'rook';
  }
  if (types.has('q') && !types.has('r')) return 'queen';
  if ((types.has('n') || types.has('b')) && !types.has('r') && !types.has('q')) {
    return 'minor-piece';
  }
  if (pawns > 0 && !types.has('r') && !types.has('q')) return 'pawn';
  if (types.has('r')) return 'rook';
  if (types.has('q')) return 'queen';
  return 'pawn';
}

export function inferEndgameConcepts(
  fen: string,
  family: EndgameFamily,
  metrics?: DrawWalkMetrics | null,
): EndgameConcept[] {
  const out = new Set<EndgameConcept>();
  const ps = pieces(fen);
  const pawns = ps.filter((p) => p.type === 'p');

  if (family === 'pawn' || pawns.length > 0) {
    const onAorH = pawns.some((p) => {
      const file = fen.includes('/') ? -1 : -1; // use board
      return false;
    });
    void onAorH;
    const g = new Chess(fen);
    const board = g.board();
    for (const row of board) {
      for (const cell of row) {
        if (cell?.type === 'p' && (cell.square[0] === 'a' || cell.square[0] === 'h')) {
          out.add('square-of-pawn');
        }
      }
    }
    if (pawns.length >= 2) out.add('promotion-race');
    out.add('king-activity');
    if (metrics && metrics.drawingMoves <= 2) out.add('accurate-defense');
    if (metrics && metrics.drawingRatio < 0.35) out.add('opposition');
    else out.add('opposition');
  }

  if (family === 'rook') {
    out.add('rook-activity');
    out.add('king-activity');
    if (metrics && metrics.drawingRatio < 0.3) out.add('accurate-defense');
  }

  if (family === 'queen') {
    out.add('king-activity');
    if (metrics && metrics.drawingRatio > 0.35) out.add('perpetual-check');
    else out.add('accurate-defense');
  }

  if (family === 'minor-piece') {
    out.add('king-activity');
    const bishops = ps.filter((p) => p.type === 'b');
    if (bishops.length === 2 && bishops[0]!.color !== bishops[1]!.color) {
      out.add('fortress');
    }
    out.add('accurate-defense');
  }

  if (family === 'fortress') {
    out.add('fortress');
    out.add('accurate-defense');
    out.add('king-activity');
  }

  if (family === 'imbalanced') {
    if (hasType(fen, 'r') && hasType(fen, 'q')) out.add('accurate-defense');
    if (hasType(fen, 'r')) out.add('rook-activity');
    out.add('king-activity');
    if (metrics && metrics.drawingMoves === 1) out.add('accurate-defense');
  }

  if (metrics) {
    if (metrics.drawingRatio < 0.25 && metrics.drawingMoves <= 2) {
      out.add('zugzwang');
    }
    if (metrics.uniqueMoveMoments >= 1) out.add('accurate-defense');
    if (metrics.criticalMoves >= 2) out.add('distant-opposition');
  }

  const list = [...out];
  if (list.length === 0) list.push('accurate-defense');
  return list.slice(0, 4) as EndgameConcept[];
}

export function countMaterialImbalance(fen: string): number {
  const vals: Record<string, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
  };
  let w = 0;
  let b = 0;
  for (const p of pieces(fen)) {
    if (p.type === 'k') continue;
    const v = vals[p.type] ?? 0;
    if (p.color === 'w') w += v;
    else b += v;
  }
  return Math.abs(w - b);
}

export { pieceCount, pawnCount };
