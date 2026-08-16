/**
 * Curated theoretically-drawn endgames bank for Défends la nulle.
 *
 * Positions are chosen for defensive tension — NOT dead material.
 * `legalMoves` / `drawingMoves` are start-position estimates used for
 * defensive-precision filtering (tablebase is the runtime truth).
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import { isEligibleDefendDrawPosition } from './defensivePrecision.ts';
import { defensivePrecision } from './wdl.ts';

export type DefendDrawPosition = {
  id: string;
  fen: string;
  /** Side the user defends with (always to move in fen). */
  playerColor: 'w' | 'b';
  difficulty: AnyChessDifficultyId;
  label: string;
  theme: string;
  /** Legal moves in the start position. */
  legalMoves: number;
  /** How many of those preserve DRAW with best play. */
  drawingMoves: number;
};

export const DEFEND_DRAW_POSITIONS: readonly DefendDrawPosition[] = [
  // ── Débutant — real themes, several holds ─────────────────────────────────
  {
    id: 'opp-ke6-pe5',
    fen: '4k3/8/4K3/4P3/8/8/8/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'debutant',
    label: 'Opposition',
    theme: 'opposition',
    legalMoves: 2,
    drawingMoves: 2,
  },
  {
    id: 'square-a5',
    fen: '8/8/8/P7/8/8/8/k1K5 b - - 0 1',
    playerColor: 'b',
    difficulty: 'debutant',
    label: 'Carré du pion',
    theme: 'pawn-square',
    legalMoves: 1,
    drawingMoves: 1,
  },
  {
    id: 'king-front-d',
    fen: '8/8/8/3k4/3P4/3K4/8/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'debutant',
    label: 'Roi devant le pion',
    theme: 'king-front',
    legalMoves: 3,
    drawingMoves: 2,
  },
  {
    id: 'pawn-race-simple',
    fen: '8/1p6/8/8/8/8/1P6/k1K5 w - - 0 1',
    playerColor: 'w',
    difficulty: 'debutant',
    label: 'Course de pions',
    theme: 'pawn-race',
    legalMoves: 5,
    drawingMoves: 3,
  },
  {
    id: 'rp-short',
    fen: '8/8/8/8/7P/6k1/8/6K1 b - - 0 1',
    playerColor: 'b',
    difficulty: 'debutant',
    label: 'Pion tour',
    theme: 'rook-pawn',
    legalMoves: 5,
    drawingMoves: 3,
  },
  {
    id: 'passed-block',
    fen: '8/8/4k3/3p4/3P4/4K3/8/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'debutant',
    label: 'Blocage de pion',
    theme: 'blockade',
    legalMoves: 5,
    drawingMoves: 3,
  },

  // ── Confirmé — precision required, several themes ─────────────────────────
  {
    id: 'philidor-6th',
    fen: '4r3/8/8/3Pk3/8/3K4/8/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'confirme',
    label: 'Philidor (6e rangée)',
    theme: 'philidor',
    legalMoves: 14,
    drawingMoves: 4,
  },
  {
    id: '2p-vs-1p',
    fen: '8/8/1p2k3/8/1P2K3/1P6/8/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'confirme',
    label: 'Deux pions contre un',
    theme: 'multi-pawn',
    legalMoves: 6,
    drawingMoves: 2,
  },
  {
    id: 'opp-b-pawns',
    fen: '8/5pk1/5b2/8/5B2/5PK1/8/8 w - - 0 1',
    playerColor: 'w',
    difficulty: 'confirme',
    label: 'Fous opposés + pions',
    theme: 'opposite-bishops',
    legalMoves: 14,
    drawingMoves: 5,
  },
  {
    id: 'r-vs-rp',
    fen: '8/8/8/4k3/8/4P3/4R3/4K2r b - - 0 1',
    playerColor: 'b',
    difficulty: 'confirme',
    label: 'Tour contre tour+pion',
    theme: 'rook-ending',
    legalMoves: 16,
    drawingMoves: 4,
  },
  {
    id: 'q-vs-q-checks',
    fen: '8/8/4k3/8/8/4K3/4Q3/4q3 b - - 0 1',
    playerColor: 'b',
    difficulty: 'confirme',
    label: 'Dame contre dame',
    theme: 'queen-ending',
    legalMoves: 23,
    drawingMoves: 6,
  },
  {
    id: 'dangerous-passer',
    fen: '8/8/8/3kP3/8/3K4/8/4r3 b - - 0 1',
    playerColor: 'b',
    difficulty: 'confirme',
    label: 'Pion passé dangereux',
    theme: 'passer',
    legalMoves: 15,
    drawingMoves: 3,
  },

  // ── Expert — few holding moves ────────────────────────────────────────────
  {
    id: 'anti-lucena',
    fen: '1r6/5k2/8/5PK1/8/8/8/1R6 b - - 0 1',
    playerColor: 'b',
    difficulty: 'expert',
    label: 'Défense anti-Lucena',
    theme: 'lucena',
    legalMoves: 19,
    drawingMoves: 2,
  },
  {
    id: 'philidor-check',
    fen: '8/8/8/3Pk3/8/3K4/8/4r3 b - - 0 1',
    playerColor: 'b',
    difficulty: 'expert',
    label: 'Philidor sous pression',
    theme: 'philidor',
    legalMoves: 15,
    drawingMoves: 2,
  },
  {
    id: 'q-vs-r-hold',
    fen: '8/8/8/4k3/8/4q3/8/3RK3 w - - 0 1',
    playerColor: 'w',
    difficulty: 'expert',
    label: 'Tour contre dame',
    theme: 'queen-vs-rook',
    legalMoves: 3,
    drawingMoves: 1,
  },
  {
    id: 'rp-rp-complex',
    fen: '8/8/4k3/8/5P2/8/4R3/4K2r b - - 0 1',
    playerColor: 'b',
    difficulty: 'expert',
    label: 'Tours + pion',
    theme: 'rook-ending',
    legalMoves: 6,
    drawingMoves: 2,
  },
  {
    id: 'bn-pawns',
    fen: '8/5pk1/5n2/8/5N2/5PK1/8/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'expert',
    label: 'Cavaliers + pions',
    theme: 'minor-pawns',
    legalMoves: 13,
    drawingMoves: 3,
  },
  {
    id: 'promo-race',
    fen: '8/4P1k1/8/8/8/8/4K3/5r2 b - - 0 1',
    playerColor: 'b',
    difficulty: 'expert',
    label: 'Promotion imminente',
    theme: 'promotion',
    legalMoves: 21,
    drawingMoves: 2,
  },

  // ── Grand-Maître — extreme precision ──────────────────────────────────────
  {
    id: 'only-opp',
    fen: '8/8/8/4k3/8/3K4/4P3/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'grandMaitre',
    label: 'Seul coup : opposition',
    theme: 'only-move',
    legalMoves: 6,
    drawingMoves: 1,
  },
  {
    id: 'q-r-fortress',
    fen: '8/8/8/8/4k3/8/3q4/3RK3 w - - 0 1',
    playerColor: 'w',
    difficulty: 'grandMaitre',
    label: 'Forteresse tour/dame',
    theme: 'queen-vs-rook',
    legalMoves: 3,
    drawingMoves: 1,
  },
  {
    id: 'vancura-style',
    fen: '8/8/8/8/R7/5k2/P7/6K1 b - - 0 1',
    playerColor: 'b',
    difficulty: 'grandMaitre',
    label: 'Défense type Vancura',
    theme: 'vancura',
    legalMoves: 3,
    drawingMoves: 1,
  },
  {
    id: 'zugzwang-pawn',
    fen: '8/8/8/3k4/2p5/2K5/8/8 w - - 0 1',
    playerColor: 'w',
    difficulty: 'grandMaitre',
    label: 'Zugzwang de pions',
    theme: 'zugzwang',
    legalMoves: 4,
    drawingMoves: 1,
  },
  {
    id: 'rpp-hold',
    fen: '8/8/5k2/5ppp/8/5PPP/5K2/8 b - - 0 1',
    playerColor: 'b',
    difficulty: 'grandMaitre',
    label: 'Mur de pions',
    theme: 'pawn-wall',
    legalMoves: 9,
    drawingMoves: 1,
  },
  {
    id: 'q-ending-only',
    fen: '8/8/8/4k3/8/4K3/Q7/7q b - - 0 1',
    playerColor: 'b',
    difficulty: 'grandMaitre',
    label: 'Dame : seul échec',
    theme: 'queen-ending',
    legalMoves: 24,
    drawingMoves: 1,
  },
];

export function positionsForDifficulty(
  difficulty: AnyChessDifficultyId,
): DefendDrawPosition[] {
  return DEFEND_DRAW_POSITIONS.filter(
    (p) => p.difficulty === difficulty && isEligibleDefendDrawPosition(p),
  );
}

export function pickDefendDrawPosition(
  difficulty: AnyChessDifficultyId,
  recentIds: string[] = [],
  rng: () => number = Math.random,
): DefendDrawPosition {
  const pool = positionsForDifficulty(difficulty);
  const fresh = pool.filter((p) => !recentIds.includes(p.id));
  const use = fresh.length > 0 ? fresh : pool.length > 0 ? pool : DEFEND_DRAW_POSITIONS.filter(
    (p) => p.difficulty === difficulty,
  );
  // Prefer harder (lower precision) within the band, with some randomness.
  const scored = [...use].sort((a, b) => {
    const pa = defensivePrecision(a.drawingMoves, a.legalMoves);
    const pb = defensivePrecision(b.drawingMoves, b.legalMoves);
    return pa - pb;
  });
  const window = Math.max(1, Math.ceil(scored.length * 0.6));
  const candidates = scored.slice(0, window);
  return candidates[Math.floor(rng() * candidates.length)]!;
}

/**
 * Opponent strength for this mode: always near-max.
 * Difficulty changes the *position*, not a weak engine.
 */
export function opponentEloForDifficulty(_difficulty: AnyChessDifficultyId): number {
  return 3190;
}

export function opponentMoveTimeMs(): number {
  return 900;
}
