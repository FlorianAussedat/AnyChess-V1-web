import type { RawCandidate } from './candidateTypes.ts';

/**
 * Curated theoretical draw seeds — each must still pass Syzygy certification.
 * Sources: classical endgame theory (opposition, Philidor, Vancura, fortresses).
 */
export const THEORETICAL_DRAW_SEEDS: readonly RawCandidate[] = [
  // ── K+P vs K — opposition / key squares ───────────────────────────────────
  { fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1', defenderColor: 'b', theme: 'opposition', label: 'Opposition directe', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4P3/4K3/8/8 b - - 0 1', defenderColor: 'b', theme: 'king-front', label: 'Roi devant le pion', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/7P/6k1/8/6K1 b - - 0 1', defenderColor: 'b', theme: 'rook-pawn', label: 'Pion tour (approche)', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/8/k7/P7/K7 b - - 0 1', defenderColor: 'b', theme: 'rook-pawn', label: 'Pion tour (coin)', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/8/3k4/3P4/3K4 b - - 0 1', defenderColor: 'b', theme: 'opposition', label: 'Opposition (variante)', source: { type: 'theoretical' } },
  { fen: '8/8/8/5k2/3P4/4K4/8/8 b - - 0 1', defenderColor: 'b', theme: 'opposition', label: 'Opposition latérale', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/3P4/4K4/8/8 b - - 0 1', defenderColor: 'b', theme: 'opposition', label: 'Opposition centrale', source: { type: 'theoretical' } },
  { fen: '8/8/8/3k4/4P3/3K4/8/8 b - - 0 1', defenderColor: 'b', theme: 'king-activity', label: 'Roi actif contre pion', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/4k3/8/3KP3/8 b - - 0 1', defenderColor: 'b', theme: 'king-front', label: 'Cases-clés', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/3k4/8/2KP4/8 b - - 0 1', defenderColor: 'b', theme: 'opposition', label: 'Opposition (c-file)', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/4k3/8/4KP2/8 b - - 0 1', defenderColor: 'b', theme: 'king-front', label: 'Pion f', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/5k2/8/4KP2/8 b - - 0 1', defenderColor: 'b', theme: 'opposition', label: 'Opposition (f-pawn)', source: { type: 'theoretical' } },
  { fen: '8/8/8/P7/4k3/8/8/4K3 b - - 0 1', defenderColor: 'b', theme: 'pawn-square', label: 'Carré du pion', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/8/k7/1P6/K7 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Pion b (coin)', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/8/1k6/1P6/K7 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Pion b (b3)', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/8/2k5/2P5/2K5 w - - 0 1', defenderColor: 'w', theme: 'opposition', label: 'Opposition (blancs)', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/8/3k4/3P4/3K4 w - - 0 1', defenderColor: 'w', theme: 'opposition', label: 'Opposition blanche', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/4k3/8/4P3/4K3 w - - 0 1', defenderColor: 'w', theme: 'king-front', label: 'Roi devant (blancs)', source: { type: 'theoretical' } },

  // ── Pawn races / blockades ────────────────────────────────────────────────
  { fen: '8/1p6/8/8/8/8/1P6/k1K5 w - - 0 1', defenderColor: 'w', theme: 'pawn-race', label: 'Course de pions', source: { type: 'theoretical' } },
  { fen: '8/8/8/2k5/2p5/2P5/2K5/8 w - - 0 1', defenderColor: 'w', theme: 'blockade', label: 'Blocage de pions', source: { type: 'theoretical' } },
  { fen: '8/8/8/3k4/3p4/3P4/3K4/8 w - - 0 1', defenderColor: 'w', theme: 'blockade', label: 'Opposition de pions', source: { type: 'theoretical' } },
  { fen: '8/8/8/3k4/2p5/2P5/2K5/8 w - - 0 1', defenderColor: 'w', theme: 'zugzwang', label: 'Zugzwang de pions', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/3p4/3P4/4K3/8 w - - 0 1', defenderColor: 'w', theme: 'blockade', label: 'Pions c', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4p3/4P3/4K3/8 w - - 0 1', defenderColor: 'w', theme: 'blockade', label: 'Pions e', source: { type: 'theoretical' } },
  { fen: '8/8/8/5k2/4p3/5P2/5K2/8 w - - 0 1', defenderColor: 'w', theme: 'pawn-race', label: 'Course f', source: { type: 'theoretical' } },
  { fen: '8/8/8/8/1k6/1p6/1P6/1K6 w - - 0 1', defenderColor: 'w', theme: 'pawn-race', label: 'Course b', source: { type: 'theoretical' } },

  // ── Rook endings ──────────────────────────────────────────────────────────
  { fen: '8/8/8/4k3/8/8/4R3/4K3 w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tour contre tour', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4R3/4K3 b - - 0 1', defenderColor: 'b', theme: 'rook-activity', label: 'Tour contre tour (noirs)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4P3/4K3/4R3 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Tour + pion', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/3P4/3K4/4R3 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Tour + pion c', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4R3/3KP3 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Tour + pion d', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4r3/4P3/4K3/4R3 w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tours + pion', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4P3/5K2/5R2 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Tour active', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4r3/8/4K3/4R3 w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tours actives', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4R3/5RK1 w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tours + roi', source: { type: 'theoretical' } },
  { fen: '8/8/5k2/8/8/5P2/5K2/5R2 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Tour + pion f', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4p3/4P3/4K3/4R3 b - - 0 1', defenderColor: 'b', theme: 'rook-pawn', label: 'Tours + pions', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4P3/4K3/5R2 b - - 0 1', defenderColor: 'b', theme: 'rook-pawn', label: 'Tour défend pion', source: { type: 'theoretical' } },
  { fen: '8/4P1k1/8/8/8/8/4K3/5r2 b - - 0 1', defenderColor: 'b', theme: 'promotion', label: 'Promotion imminente', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4R3/4K2R w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tours blanches', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4r3/8/4K3/4R3 b - - 0 1', defenderColor: 'b', theme: 'rook-activity', label: 'Tours (noirs)', source: { type: 'theoretical' } },

  // ── Queen endings ─────────────────────────────────────────────────────────
  { fen: '8/8/4k3/8/8/4K3/4Q3/4q3 b - - 0 1', defenderColor: 'b', theme: 'queen-ending', label: 'Dame contre dame', source: { type: 'theoretical' } },
  { fen: '8/8/4k3/8/8/4K3/4Q3/4q3 w - - 0 1', defenderColor: 'w', theme: 'queen-ending', label: 'Dames (blancs)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4Q3/4K3/4q3 b - - 0 1', defenderColor: 'b', theme: 'perpetual-check', label: 'Dame active', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4Q3/4K3 b - - 0 1', defenderColor: 'b', theme: 'queen-ending', label: 'Dame vs roi', source: { type: 'theoretical' } },

  // ── Minor pieces ──────────────────────────────────────────────────────────
  { fen: '8/5pk1/5n2/8/5N2/5PK1/8/8 b - - 0 1', defenderColor: 'b', theme: 'minor-pawns', label: 'Cavaliers + pions', source: { type: 'theoretical' } },
  { fen: '8/8/5pk1/5b2/5B2/5PK1/8/8 w - - 0 1', defenderColor: 'w', theme: 'opposite-bishops', label: 'Fous opposés + pions', source: { type: 'theoretical' } },
  { fen: '8/8/5pk1/5b2/8/5B2/5PK1/8 w - - 0 1', defenderColor: 'w', theme: 'opposite-bishops', label: 'Fous opposés (structure)', source: { type: 'theoretical' } },
  { fen: '8/8/4pk2/4b3/8/4B3/4PK2/8 w - - 0 1', defenderColor: 'w', theme: 'opposite-bishops', label: 'Fous opposés tendus', source: { type: 'theoretical' } },
  { fen: '8/8/5pk1/5n2/8/5N2/5PK1/8 w - - 0 1', defenderColor: 'w', theme: 'minor-pawns', label: 'Cavalier + pion', source: { type: 'theoretical' } },
  { fen: '8/8/5pk1/5b2/5P2/5BK1/8/8 w - - 0 1', defenderColor: 'w', theme: 'opposite-bishops', label: 'Fou + pions', source: { type: 'theoretical' } },
  { fen: '8/8/5pk1/5n2/5P2/5NK1/8/8 w - - 0 1', defenderColor: 'w', theme: 'minor-pawns', label: 'Cavalier défense', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/5p2/5P2/5B2/5K2 w - - 0 1', defenderColor: 'w', theme: 'opposite-bishops', label: 'Fou + pions centraux', source: { type: 'theoretical' } },

  // ── Fortress / imbalanced ─────────────────────────────────────────────────
  { fen: '8/8/8/4k3/8/4r3/4K3/4Q3 w - - 0 1', defenderColor: 'w', theme: 'queen-vs-rook', label: 'Dame contre tour', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4Q3/4K3/4r3 w - - 0 1', defenderColor: 'w', theme: 'queen-vs-rook', label: 'Dame vs tour (2)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4K3/4Qr3 w - - 0 1', defenderColor: 'w', theme: 'fortress', label: 'Forteresse tour', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4r3/4K3/5Q2 w - - 0 1', defenderColor: 'w', theme: 'imbalanced', label: 'Matériel déséquilibré', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/3r4/3K4/4Q3 w - - 0 1', defenderColor: 'w', theme: 'queen-vs-rook', label: 'Dame vs tour (3)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4r3/3K4/4Q3 w - - 0 1', defenderColor: 'w', theme: 'queen-vs-rook', label: 'Dame vs tour (4)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4K3/4Qr2 w - - 0 1', defenderColor: 'w', theme: 'fortress', label: 'Forteresse dame', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4b3/4K3/4R3 w - - 0 1', defenderColor: 'w', theme: 'imbalanced', label: 'Tour vs fou', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4n3/4K3/4R3 w - - 0 1', defenderColor: 'w', theme: 'imbalanced', label: 'Tour vs cavalier', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4p3/4K3/4R3 b - - 0 1', defenderColor: 'b', theme: 'rook-pawn', label: 'Tour vs pion', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4P3/4K3/5r2 b - - 0 1', defenderColor: 'b', theme: 'imbalanced', label: 'Tour contre pion', source: { type: 'theoretical' } },

  // ── Extra rook / QvR / fortress candidates ────────────────────────────────
  { fen: '8/8/8/4k3/8/8/3R4/3K4 w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tour active (centre)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4R3/3K4 w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tour 7e rang', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4p3/4P3/4K3/5R2 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Tour + pions latéraux', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/3P4/3K4/4R3 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Structure d-pion', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4R3/4K2R w - - 0 1', defenderColor: 'w', theme: 'rook-activity', label: 'Tours 2e rang', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/4r3/4P3/4K3/4R3 b - - 0 1', defenderColor: 'b', theme: 'rook-activity', label: 'Tours + pion (noirs)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4P3/4K3/4R1R w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Double tour blanche', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/5P2/5K2/5R2 w - - 0 1', defenderColor: 'w', theme: 'rook-pawn', label: 'Tour + pion f (actif)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4Q3/4K3 b - - 0 1', defenderColor: 'b', theme: 'queen-ending', label: 'Dame vs roi (noirs)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4Q3/5K2/8 b - - 0 1', defenderColor: 'b', theme: 'perpetual-check', label: 'Dame + roi actif', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4K3/4Q1R w - - 0 1', defenderColor: 'w', theme: 'imbalanced', label: 'Dame + tour', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4r3/4K3/4Q3 w - - 0 1', defenderColor: 'w', theme: 'queen-vs-rook', label: 'Dame contre tour (centre)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/3r4/3K4/4Q3 w - - 0 1', defenderColor: 'w', theme: 'queen-vs-rook', label: 'Dame vs tour (d-file)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4K3/4Qr2 w - - 0 1', defenderColor: 'w', theme: 'fortress', label: 'Forteresse tour 2e', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4K3/5Qr1 w - - 0 1', defenderColor: 'w', theme: 'fortress', label: 'Forteresse tour 1e', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4b3/4K3/4R3 w - - 0 1', defenderColor: 'w', theme: 'imbalanced', label: 'Tour vs fou (centre)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/4n3/4K3/4R3 w - - 0 1', defenderColor: 'w', theme: 'imbalanced', label: 'Tour vs cavalier (centre)', source: { type: 'theoretical' } },
  { fen: '8/8/5pk1/5b2/5B2/5PK1/8/8 w - - 0 1', defenderColor: 'w', theme: 'fortress', label: 'Forteresse fous', source: { type: 'theoretical' } },
  { fen: '8/8/4pk2/4b3/8/4B3/4PK2/8 w - - 0 1', defenderColor: 'w', theme: 'fortress', label: 'Forteresse fous (tendue)', source: { type: 'theoretical' } },
  { fen: '8/8/8/4k3/8/8/4K3/4Q3 b - - 0 1', defenderColor: 'b', theme: 'queen-ending', label: 'Dame contre roi', source: { type: 'theoretical' } },
];
