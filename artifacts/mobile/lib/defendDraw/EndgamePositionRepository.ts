/**
 * Repository of pre-certified drawn endgame starts for Défends la nulle.
 * Tablebase / offline verification happens at authoring time — not mid-game.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import { isEligibleDefendDrawPosition } from './defensivePrecision.ts';
import { DEFEND_DRAW_POSITIONS, type DefendDrawPosition } from './positions.ts';
import { defensivePrecision } from './wdl.ts';

export type CertifiedEndgamePosition = DefendDrawPosition & {
  /** Starting outcome certified at import / curation time. */
  initialOutcome: 'draw';
  /** True when curated or previously TB-verified as DRAW. */
  verified: true;
};

function asCertified(pos: DefendDrawPosition): CertifiedEndgamePosition {
  return {
    ...pos,
    initialOutcome: 'draw',
    verified: true,
  };
}

/** All curated positions tagged as certified draws. */
export function listCertifiedEndgames(): CertifiedEndgamePosition[] {
  return DEFEND_DRAW_POSITIONS.filter(isEligibleDefendDrawPosition).map(asCertified);
}

export function endgamesForDifficulty(
  difficulty: AnyChessDifficultyId,
): CertifiedEndgamePosition[] {
  return listCertifiedEndgames().filter((p) => p.difficulty === difficulty);
}

/**
 * Pick a certified start for the chosen difficulty, avoiding recent ids.
 * Prefers lower defensive precision (harder holds) within a random window.
 */
export function pickCertifiedEndgame(
  difficulty: AnyChessDifficultyId,
  recentIds: string[] = [],
  rng: () => number = Math.random,
): CertifiedEndgamePosition {
  const pool = endgamesForDifficulty(difficulty);
  const fresh = pool.filter((p) => !recentIds.includes(p.id));
  const use =
    fresh.length > 0
      ? fresh
      : pool.length > 0
        ? pool
        : listCertifiedEndgames().filter((p) => p.difficulty === difficulty);

  const scored = [...use].sort((a, b) => {
    const pa = defensivePrecision(a.drawingMoves, a.legalMoves);
    const pb = defensivePrecision(b.drawingMoves, b.legalMoves);
    return pa - pb;
  });
  const window = Math.max(1, Math.ceil(scored.length * 0.6));
  const candidates = scored.slice(0, window);
  return candidates[Math.floor(rng() * candidates.length)]!;
}

export class EndgamePositionRepository {
  list(difficulty?: AnyChessDifficultyId): CertifiedEndgamePosition[] {
    return difficulty ? endgamesForDifficulty(difficulty) : listCertifiedEndgames();
  }

  pick(
    difficulty: AnyChessDifficultyId,
    recentIds: string[] = [],
    rng: () => number = Math.random,
  ): CertifiedEndgamePosition {
    return pickCertifiedEndgame(difficulty, recentIds, rng);
  }
}

export const endgamePositionRepository = new EndgamePositionRepository();
