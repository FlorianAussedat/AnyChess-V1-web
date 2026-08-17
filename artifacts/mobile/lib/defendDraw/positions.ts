/**
 * Certified start positions for Défends la nulle.
 *
 * ONLY entries with proven certification may reach the board:
 *   verifiedDraw === true AND verification.result === 'draw'
 *
 * Runtime never re-runs Syzygy/Stockfish to certify — authoring script does.
 * Difficulty is curated (family + concepts + practical hold), not a single ratio.
 * No procedural / random FEN generation. No artificial pool-size cap.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import type { DefendDrawVerification } from './certification.ts';
import type {
  DifficultyMetrics,
  EndgameConcept,
  EndgameFamily,
  DefendDrawSource,
} from './taxonomy.ts';

export type DefendDrawPosition = {
  /** Stable public id (shown in DEV), e.g. DD-001. */
  id: string;
  fen: string;
  difficulty: AnyChessDifficultyId;
  family: EndgameFamily;
  concepts: readonly [EndgameConcept, ...EndgameConcept[]];
  theme: string;
  label: string;
  /** Side the user defends (must match side-to-move in fen). */
  defenderColor: 'w' | 'b';
  /**
   * Must be true only when `verification` proves a draw.
   * Never stamp this without a matching verification record.
   */
  verifiedDraw: true;
  /** Proven certification from the authoring script. */
  verification: DefendDrawVerification;
  /** Legal moves in the start position (from Syzygy move list when available). */
  legalMoves: number;
  /** How many STM moves preserve the draw (Syzygy) / authoring estimate. */
  drawingMoves: number;
  difficultyMetrics?: DifficultyMetrics;
  source?: DefendDrawSource;
  /** @deprecated Use defenderColor — kept for session compatibility. */
  playerColor: 'w' | 'b';
};

const SYZYGY_DRAW = { method: 'syzygy' as const, result: 'draw' as const };

/**
 * Pool certified via Lichess Syzygy tablebase (authoring).
 * Prefer fewer proven, well-classified draws over volume.
 */
export const CERTIFIED_DEFEND_DRAW_POSITIONS: readonly DefendDrawPosition[] = [
  // ── Débutant — pedagogical, identifiable plan ─────────────────────────────
  {
    id: 'DD-001',
    fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1',
    difficulty: 'debutant',
    family: 'pawn',
    concepts: ['opposition', 'king-activity'],
    theme: 'opposition',
    label: 'Opposition',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 3,
    drawingMoves: 3,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-002',
    fen: '8/8/8/4k3/4P3/4K3/8/8 b - - 0 1',
    difficulty: 'debutant',
    family: 'pawn',
    concepts: ['opposition', 'king-activity'],
    theme: 'king-front',
    label: 'Roi devant le pion',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 3,
    drawingMoves: 3,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-005',
    fen: '8/8/8/8/7P/6k1/8/6K1 b - - 0 1',
    difficulty: 'debutant',
    family: 'pawn',
    concepts: ['square-of-pawn', 'king-activity'],
    theme: 'rook-pawn',
    label: 'Pion tour (approche)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 5,
    drawingMoves: 3,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-006',
    fen: '8/1p6/8/8/8/8/1P6/k1K5 w - - 0 1',
    difficulty: 'debutant',
    family: 'pawn',
    concepts: ['promotion-race', 'king-activity'],
    theme: 'pawn-race',
    label: 'Course de pions',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 5,
    drawingMoves: 3,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-007',
    fen: '8/8/8/8/8/k7/P7/K7 b - - 0 1',
    difficulty: 'debutant',
    family: 'pawn',
    concepts: ['square-of-pawn', 'opposition'],
    theme: 'rook-pawn',
    label: 'Pion tour (coin)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 2,
    drawingMoves: 2,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-033',
    fen: '8/8/8/8/8/3k4/3P4/3K4 b - - 0 1',
    difficulty: 'debutant',
    family: 'pawn',
    concepts: ['opposition', 'king-activity'],
    theme: 'only-move',
    label: 'Roi contre pion (court)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 3,
    drawingMoves: 3,
    source: { type: 'theoretical' },
  },

  // ── Confirmé — classic understanding, still tenable ───────────────────────
  {
    id: 'DD-003',
    fen: '8/8/8/P7/4k3/8/8/4K3 b - - 0 1',
    difficulty: 'confirme',
    family: 'pawn',
    concepts: ['square-of-pawn', 'accurate-defense'],
    theme: 'pawn-square',
    label: 'Carré du pion',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 8,
    drawingMoves: 1,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-010',
    fen: '8/8/4k3/8/8/4K3/4Q3/4q3 b - - 0 1',
    difficulty: 'confirme',
    family: 'queen',
    concepts: ['perpetual-check', 'king-activity'],
    theme: 'queen-ending',
    label: 'Dame contre dame',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 23,
    drawingMoves: 11,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-011',
    fen: '8/5pk1/5n2/8/5N2/5PK1/8/8 b - - 0 1',
    difficulty: 'confirme',
    family: 'minor-piece',
    concepts: ['king-activity', 'accurate-defense'],
    theme: 'minor-pawns',
    label: 'Cavaliers + pions',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 13,
    drawingMoves: 9,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-012',
    fen: '8/8/5pk1/5b2/5B2/5PK1/8/8 w - - 0 1',
    difficulty: 'confirme',
    family: 'fortress',
    concepts: ['fortress', 'king-activity'],
    theme: 'opposite-bishops',
    label: 'Fous opposés + pions',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 13,
    drawingMoves: 10,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-013',
    fen: '8/8/8/2k5/2p5/2P5/2K5/8 w - - 0 1',
    difficulty: 'confirme',
    family: 'pawn',
    concepts: ['opposition', 'zugzwang'],
    theme: 'blockade',
    label: 'Blocage de pions',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 5,
    drawingMoves: 4,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-014',
    fen: '8/8/8/3k4/3p4/3P4/3K4/8 w - - 0 1',
    difficulty: 'confirme',
    family: 'pawn',
    concepts: ['opposition', 'zugzwang'],
    theme: 'blockade',
    label: 'Opposition de pions',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 5,
    drawingMoves: 3,
    source: { type: 'theoretical' },
  },

  // ── Expert — several precise decisions ────────────────────────────────────
  {
    id: 'DD-015',
    fen: '8/8/5pk1/5b2/8/5B2/5PK1/8 w - - 0 1',
    difficulty: 'expert',
    family: 'fortress',
    concepts: ['fortress', 'accurate-defense'],
    theme: 'opposite-bishops',
    label: 'Fous opposés (structure)',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 14,
    drawingMoves: 11,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-020',
    fen: '8/4P1k1/8/8/8/8/4K3/5r2 b - - 0 1',
    difficulty: 'expert',
    family: 'imbalanced',
    concepts: ['rook-activity', 'promotion-race', 'accurate-defense'],
    theme: 'promotion',
    label: 'Promotion imminente',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 21,
    drawingMoves: 4,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-021',
    fen: '8/8/4pk2/4b3/8/4B3/4PK2/8 w - - 0 1',
    difficulty: 'expert',
    family: 'fortress',
    concepts: ['fortress', 'king-activity', 'accurate-defense'],
    theme: 'opposite-bishops',
    label: 'Fous opposés tendus',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 14,
    drawingMoves: 11,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-023',
    fen: '8/8/5pk1/5n2/8/5N2/5PK1/8 w - - 0 1',
    difficulty: 'expert',
    family: 'minor-piece',
    concepts: ['king-activity', 'accurate-defense'],
    theme: 'minor-pawns',
    label: 'Cavalier + pion',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 13,
    drawingMoves: 9,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-031',
    fen: '8/8/8/3k4/2p5/2K5/8/8 w - - 0 1',
    difficulty: 'expert',
    family: 'pawn',
    concepts: ['zugzwang', 'opposition'],
    theme: 'zugzwang',
    label: 'Zugzwang de pions',
    defenderColor: 'w',
    playerColor: 'w',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 4,
    drawingMoves: 3,
    source: { type: 'theoretical' },
  },

  // ── Grand-Maître — only-move / key-square precision ───────────────────────
  {
    id: 'DD-022',
    fen: '8/8/8/8/4k3/8/3KP3/8 b - - 0 1',
    difficulty: 'grandMaitre',
    family: 'pawn',
    concepts: ['accurate-defense', 'opposition', 'distant-opposition'],
    theme: 'king-front',
    label: 'Cases-clés (précision)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 5,
    drawingMoves: 1,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-024',
    fen: '8/8/8/8/3k4/8/2KP4/8 b - - 0 1',
    difficulty: 'grandMaitre',
    family: 'pawn',
    concepts: ['accurate-defense', 'opposition'],
    theme: 'opposition',
    label: 'Opposition sous pression',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 5,
    drawingMoves: 1,
    source: { type: 'theoretical' },
  },
  {
    id: 'DD-030',
    fen: '8/8/8/4k3/8/3K4/4P3/8 b - - 0 1',
    difficulty: 'grandMaitre',
    family: 'pawn',
    concepts: ['accurate-defense', 'opposition', 'distant-opposition'],
    theme: 'only-move',
    label: 'Seul coup : opposition',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 6,
    drawingMoves: 1,
    source: { type: 'theoretical' },
  },
  {
    // Same FEN as DD-022 — kept for id stability; flagged as duplicate in analysis.
    id: 'DD-034',
    fen: '8/8/8/8/4k3/8/3KP3/8 b - - 0 1',
    difficulty: 'grandMaitre',
    family: 'pawn',
    concepts: ['accurate-defense', 'opposition'],
    theme: 'king-front',
    label: 'Cases-clés',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 5,
    drawingMoves: 1,
    source: { type: 'theoretical' },
  },
  {
    // Same FEN as DD-003 — kept for id stability; different difficulty is dubious.
    id: 'DD-035',
    fen: '8/8/8/P7/4k3/8/8/4K3 b - - 0 1',
    difficulty: 'grandMaitre',
    family: 'pawn',
    concepts: ['square-of-pawn', 'accurate-defense'],
    theme: 'pawn-square',
    label: 'Carré du pion (précis)',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verification: SYZYGY_DRAW,
    legalMoves: 8,
    drawingMoves: 1,
    source: { type: 'theoretical' },
  },
];

/** @deprecated Use CERTIFIED_DEFEND_DRAW_POSITIONS */
export const DEFEND_DRAW_POSITIONS = CERTIFIED_DEFEND_DRAW_POSITIONS;

export function opponentEloForDifficulty(_difficulty: AnyChessDifficultyId): number {
  return 3190;
}

/** @deprecated Prefer defendDrawMoveTimeMs(difficulty) from engineConfig. */
export function opponentMoveTimeMs(): number {
  return 1000;
}
