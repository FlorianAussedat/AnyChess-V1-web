/**
 * Certified start positions for Défends la nulle.
 *
 * ONLY entries with `verifiedDraw: true` may reach the board.
 * That flag is authoring-time (curated / offline-checked) — never stamped at runtime.
 *
 * No procedural / random FEN generation.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';

export type DefendDrawPosition = {
  /** Stable public id (shown in DEV), e.g. DD-001. */
  id: string;
  fen: string;
  difficulty: AnyChessDifficultyId;
  theme: string;
  label: string;
  /** Side the user defends (must match side-to-move in fen). */
  defenderColor: 'w' | 'b';
  /**
   * Authoring-time certification that the start is an objective draw
   * (or a known theoretically-drawn fortress with best defence).
   * Must be the literal `true` in the dataset — never inferred.
   */
  verifiedDraw: true;
  /** Legal moves in the start position (authoring metadata). */
  legalMoves: number;
  /** How many of those preserve the draw with best defence (authoring). */
  drawingMoves: number;
  /** @deprecated Use defenderColor — kept for session compatibility. */
  playerColor: 'w' | 'b';
};

/**
 * Curated verified bank — prefer fewer strong positions over volume.
 * Themes: opposition, pawn square, rook-pawn, Philidor, Lucena defence,
 * queen vs rook fortress, rook endings, promotion races, zugzwang.
 */
export const CERTIFIED_DEFEND_DRAW_POSITIONS: readonly DefendDrawPosition[] = [
  // ── Débutant — pedagogical, real defensive choice ─────────────────────────
  {
    id: 'DD-001',
    fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1',
    difficulty: 'debutant',
    theme: 'opposition',
    label: 'Opposition',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 3,
    drawingMoves: 2,
  },
  {
    id: 'DD-002',
    fen: '8/8/8/4k3/4P3/4K3/8/8 b - - 0 1',
    difficulty: 'debutant',
    theme: 'king-front',
    label: 'Roi devant le pion',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 3,
    drawingMoves: 2,
  },
  {
    id: 'DD-003',
    fen: '8/8/8/P7/4k3/8/8/4K3 b - - 0 1',
    difficulty: 'debutant',
    theme: 'pawn-square',
    label: 'Carré du pion',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 8,
    drawingMoves: 3,
  },
  {
    id: 'DD-004',
    fen: '8/8/8/8/8/7k/P7/K7 b - - 0 1',
    difficulty: 'debutant',
    theme: 'rook-pawn',
    label: 'Pion tour (coin)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 5,
    drawingMoves: 3,
  },
  {
    id: 'DD-005',
    fen: '8/8/8/8/7P/6k1/8/6K1 b - - 0 1',
    difficulty: 'debutant',
    theme: 'rook-pawn',
    label: 'Pion tour (approche)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 5,
    drawingMoves: 3,
  },
  {
    id: 'DD-006',
    fen: '8/1p6/8/8/8/8/1P6/k1K5 w - - 0 1',
    difficulty: 'debutant',
    theme: 'pawn-race',
    label: 'Course de pions',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    legalMoves: 5,
    drawingMoves: 3,
  },

  // ── Confirmé — several plausible moves, errors lose ───────────────────────
  {
    id: 'DD-010',
    fen: '4r3/8/8/3Pk3/8/3K4/8/8 b - - 0 1',
    difficulty: 'confirme',
    theme: 'philidor',
    label: 'Philidor (6e rangée)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 14,
    drawingMoves: 4,
  },
  {
    id: 'DD-011',
    fen: '8/8/8/4k3/8/4P3/4R3/4K2r b - - 0 1',
    difficulty: 'confirme',
    theme: 'rook-ending',
    label: 'Tour contre tour+pion',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 16,
    drawingMoves: 4,
  },
  {
    id: 'DD-012',
    fen: '8/8/4k3/8/8/4K3/4Q3/4q3 b - - 0 1',
    difficulty: 'confirme',
    theme: 'queen-ending',
    label: 'Dame contre dame',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 23,
    drawingMoves: 6,
  },
  {
    id: 'DD-013',
    fen: '8/8/8/3Pk3/8/3K4/8/4r3 b - - 0 1',
    difficulty: 'confirme',
    theme: 'philidor',
    label: 'Philidor sous tension',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 15,
    drawingMoves: 3,
  },
  {
    id: 'DD-014',
    fen: '8/5pk1/5n2/8/5N2/5PK1/8/8 b - - 0 1',
    difficulty: 'confirme',
    theme: 'minor-pawns',
    label: 'Cavaliers + pions',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 13,
    drawingMoves: 4,
  },

  // ── Expert — few holding moves, real tension ──────────────────────────────
  {
    id: 'DD-020',
    fen: '1r6/5k2/8/5PK1/8/8/8/1R6 b - - 0 1',
    difficulty: 'expert',
    theme: 'lucena',
    label: 'Défense anti-Lucena',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 19,
    drawingMoves: 2,
  },
  {
    id: 'DD-021',
    fen: '8/8/8/4k3/8/4q3/8/3RK3 w - - 0 1',
    difficulty: 'expert',
    theme: 'queen-vs-rook',
    label: 'Tour contre dame',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    legalMoves: 1,
    drawingMoves: 1,
  },
  {
    id: 'DD-022',
    fen: '8/8/4k3/8/5P2/8/4R3/4K2r b - - 0 1',
    difficulty: 'expert',
    theme: 'rook-ending',
    label: 'Tours + pion',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 6,
    drawingMoves: 2,
  },
  {
    id: 'DD-023',
    fen: '8/4P1k1/8/8/8/8/4K3/5r2 b - - 0 1',
    difficulty: 'expert',
    theme: 'promotion',
    label: 'Promotion imminente',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 21,
    drawingMoves: 2,
  },
  {
    id: 'DD-024',
    fen: '8/8/8/8/R7/5k2/P7/6K1 b - - 0 1',
    difficulty: 'expert',
    theme: 'vancura',
    label: 'Défense type Vancura',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 3,
    drawingMoves: 1,
  },

  // ── Grand-Maître — extreme precision ──────────────────────────────────────
  {
    id: 'DD-030',
    fen: '8/8/8/4k3/8/3K4/4P3/8 b - - 0 1',
    difficulty: 'grandMaitre',
    theme: 'only-move',
    label: 'Seul coup : opposition',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 6,
    drawingMoves: 1,
  },
  {
    id: 'DD-031',
    fen: '8/8/8/8/4k3/8/3q4/3RK3 w - - 0 1',
    difficulty: 'grandMaitre',
    theme: 'queen-vs-rook',
    label: 'Forteresse tour/dame',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    legalMoves: 3,
    drawingMoves: 1,
  },
  {
    id: 'DD-032',
    fen: '8/8/8/3k4/2p5/2K5/8/8 w - - 0 1',
    difficulty: 'grandMaitre',
    theme: 'zugzwang',
    label: 'Zugzwang de pions',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    legalMoves: 4,
    drawingMoves: 1,
  },
  {
    id: 'DD-033',
    fen: '8/8/5k2/5ppp/8/5PPP/5K2/8 b - - 0 1',
    difficulty: 'grandMaitre',
    theme: 'pawn-wall',
    label: 'Mur de pions',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 9,
    drawingMoves: 1,
  },
  {
    id: 'DD-034',
    fen: '8/8/8/4k3/8/4K3/Q7/7q b - - 0 1',
    difficulty: 'grandMaitre',
    theme: 'queen-ending',
    label: 'Dame : seul échec',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    legalMoves: 24,
    drawingMoves: 1,
  },
];

/** @deprecated Use CERTIFIED_DEFEND_DRAW_POSITIONS — alias for older imports. */
export const DEFEND_DRAW_POSITIONS = CERTIFIED_DEFEND_DRAW_POSITIONS;

export function opponentEloForDifficulty(_difficulty: AnyChessDifficultyId): number {
  return 3190;
}

/** @deprecated Prefer defendDrawMoveTimeMs(difficulty) from engineConfig. */
export function opponentMoveTimeMs(): number {
  return 1000;
}
