/**
 * Curated drawn endgame starts for Défends la nulle, by difficulty.
 * Positions are intended to be theoretically drawn with accurate play.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';

export type DefendDrawPosition = {
  id: string;
  fen: string;
  /** Side the user defends with. */
  playerColor: 'w' | 'b';
  difficulty: AnyChessDifficultyId;
  label: string;
};

/**
 * FEN after any setup so it is the player's turn.
 * Keep piece counts modest so tablebase / heuristics stay meaningful.
 */
export const DEFEND_DRAW_POSITIONS: readonly DefendDrawPosition[] = [
  // Débutant — elementary theoretical draws
  {
    id: 'k-vs-k',
    fen: '8/8/8/4k3/8/8/8/4K3 w - - 0 1',
    playerColor: 'w',
    difficulty: 'debutant',
    label: 'Roi contre roi',
  },
  {
    id: 'kb-vs-k',
    fen: '8/8/8/4k3/8/8/8/4KB2 w - - 0 1',
    playerColor: 'w',
    difficulty: 'debutant',
    label: 'Roi + fou contre roi',
  },
  {
    id: 'kn-vs-k',
    fen: '8/8/8/4k3/8/8/8/4KN2 w - - 0 1',
    playerColor: 'w',
    difficulty: 'debutant',
    label: 'Roi + cavalier contre roi',
  },
  {
    id: 'kp-vs-k-drawn',
    fen: '8/8/8/8/8/1k6/1P6/1K6 w - - 0 1',
    playerColor: 'w',
    difficulty: 'debutant',
    label: 'Pion bloqué',
  },
  // Confirmé
  {
    id: 'opp-bishops',
    fen: '8/8/3k4/8/2b5/8/3B4/3K4 w - - 0 1',
    playerColor: 'w',
    difficulty: 'confirme',
    label: 'Fous de couleurs opposées',
  },
  {
    id: 'knn-vs-k',
    fen: '8/8/8/4k3/8/8/8/2N1KN2 w - - 0 1',
    playerColor: 'w',
    difficulty: 'confirme',
    label: 'Deux cavaliers',
  },
  {
    id: 'rook-pawn-wrong-bishop',
    fen: '8/8/8/8/7k/8/6P1/6KB w - - 0 1',
    playerColor: 'w',
    difficulty: 'confirme',
    label: 'Pion tour + mauvais fou',
  },
  // Expert
  {
    id: 'r-vs-r',
    fen: '8/8/8/3rk3/8/8/8/3RK3 w - - 0 1',
    playerColor: 'w',
    difficulty: 'expert',
    label: 'Tour contre tour',
  },
  {
    id: 'rp-vs-r',
    fen: '8/8/8/4k3/8/5P2/4R3/4K2r w - - 0 1',
    playerColor: 'w',
    difficulty: 'expert',
    label: 'Tour + pion vs tour',
  },
  {
    id: 'q-vs-q',
    fen: '8/8/8/3qk3/8/8/8/3QK3 w - - 0 1',
    playerColor: 'w',
    difficulty: 'expert',
    label: 'Dame contre dame',
  },
  // Grand-Maître — denser / sharper
  {
    id: 'rpp-vs-rp',
    fen: '8/8/4k3/8/5PP1/8/4R3/4K2r w - - 0 1',
    playerColor: 'w',
    difficulty: 'grandMaitre',
    label: 'Tour + 2 pions vs tour + pion',
  },
  {
    id: 'bn-vs-r',
    fen: '8/8/8/4k3/8/8/8/2B1KN1r w - - 0 1',
    playerColor: 'w',
    difficulty: 'grandMaitre',
    label: 'Fou + cavalier vs tour',
  },
  {
    id: 'fortress-bishops',
    fen: '8/8/2b1k3/8/8/2B1K3/8/8 w - - 0 1',
    playerColor: 'w',
    difficulty: 'grandMaitre',
    label: 'Forteresse de fous',
  },
];

export function positionsForDifficulty(
  difficulty: AnyChessDifficultyId,
): DefendDrawPosition[] {
  const exact = DEFEND_DRAW_POSITIONS.filter((p) => p.difficulty === difficulty);
  if (exact.length > 0) return exact;
  return [...DEFEND_DRAW_POSITIONS];
}

export function pickDefendDrawPosition(
  difficulty: AnyChessDifficultyId,
  recentIds: string[] = [],
  rng: () => number = Math.random,
): DefendDrawPosition {
  const pool = positionsForDifficulty(difficulty);
  const fresh = pool.filter((p) => !recentIds.includes(p.id));
  const use = fresh.length > 0 ? fresh : pool;
  return use[Math.floor(rng() * use.length)]!;
}

/** Opponent UCI Elo hint for Stockfish fallback (when available). */
export function opponentEloForDifficulty(difficulty: AnyChessDifficultyId): number {
  switch (difficulty) {
    case 'debutant':
      return 1200;
    case 'confirme':
      return 1600;
    case 'expert':
      return 2000;
    case 'grandMaitre':
      return 2400;
  }
}
