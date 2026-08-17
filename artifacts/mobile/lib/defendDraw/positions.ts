/**
 * Certified start positions for Défends la nulle.
 *
 * ONLY entries with proven certification may reach the board:
 *   verifiedDraw === true AND verification.result === 'draw'
 *
 * Pool body lives in data/pool.generated.ts (built offline).
 * Runtime never re-runs Syzygy/Stockfish to certify.
 * No procedural / random FEN generation at runtime. No artificial pool-size cap.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import type { DefendDrawVerification } from './certification.ts';
import type {
  DifficultyMetrics,
  EndgameConcept,
  EndgameFamily,
  DefendDrawSource,
} from './taxonomy.ts';
import { GENERATED_DEFEND_DRAW_POOL } from './data/pool.generated.ts';

export type DefendDrawPosition = {
  id: string;
  fen: string;
  difficulty: AnyChessDifficultyId;
  family: EndgameFamily;
  concepts: readonly [EndgameConcept, ...EndgameConcept[]];
  theme: string;
  label: string;
  defenderColor: 'w' | 'b';
  verifiedDraw: true;
  verification: DefendDrawVerification;
  legalMoves: number;
  drawingMoves: number;
  difficultyMetrics?: DifficultyMetrics;
  source?: DefendDrawSource;
  playerColor: 'w' | 'b';
};

export const CERTIFIED_DEFEND_DRAW_POSITIONS: readonly DefendDrawPosition[] =
  GENERATED_DEFEND_DRAW_POOL;

/** @deprecated Use CERTIFIED_DEFEND_DRAW_POSITIONS */
export const DEFEND_DRAW_POSITIONS = CERTIFIED_DEFEND_DRAW_POSITIONS;

export function opponentEloForDifficulty(_difficulty: AnyChessDifficultyId): number {
  return 3190;
}

/** @deprecated Prefer defendDrawMoveTimeMs(difficulty) from engineConfig. */
export function opponentMoveTimeMs(): number {
  return 1000;
}
