/**
 * Repository of pre-certified drawn endgame starts for Défends la nulle.
 *
 * Selection never trusts a bare "draw" label: only `verifiedDraw: true`
 * dataset rows that pass FEN + triviality gates may be returned.
 * No random / procedural FEN fallback.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import {
  isEligibleDefendDrawPosition,
  isTrivialDefendDrawPosition,
} from './defensivePrecision.ts';
import { validateDefendDrawFen } from './fenValidation.ts';
import {
  CERTIFIED_DEFEND_DRAW_POSITIONS,
  type DefendDrawPosition,
} from './positions.ts';

export type CertifiedEndgamePosition = DefendDrawPosition & {
  verifiedDraw: true;
  /** @deprecated Prefer verifiedDraw — kept for older callers. */
  verified: true;
  /** @deprecated Prefer verifiedDraw. */
  initialOutcome: 'draw';
};

export class DefendDrawPoolEmptyError extends Error {
  constructor(difficulty: AnyChessDifficultyId) {
    super(
      `[DefendDraw] Aucune position certifiée disponible pour « ${difficulty} ». ` +
        `Vérifiez CERTIFIED_DEFEND_DRAW_POSITIONS (verifiedDraw + filtres).`,
    );
    this.name = 'DefendDrawPoolEmptyError';
  }
}

function toCertified(pos: DefendDrawPosition): CertifiedEndgamePosition {
  return {
    ...pos,
    verifiedDraw: true,
    verified: true,
    initialOutcome: 'draw',
    playerColor: pos.defenderColor,
  };
}

function logRejected(id: string, reason: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[DefendDraw] rejected ${id}: ${reason}`);
  }
}

/**
 * Dataset rows that are structurally usable (verified + legal + non-trivial).
 * Invalid entries are skipped (and logged in DEV) — never shown.
 */
export function listCertifiedEndgames(): CertifiedEndgamePosition[] {
  const out: CertifiedEndgamePosition[] = [];
  for (const raw of CERTIFIED_DEFEND_DRAW_POSITIONS) {
    if (raw.verifiedDraw !== true) {
      logRejected(raw.id, 'verifiedDraw !== true');
      continue;
    }
    const fenCheck = validateDefendDrawFen(raw.fen, raw.defenderColor);
    if (!fenCheck.ok) {
      logRejected(raw.id, fenCheck.reason);
      continue;
    }
    if (isTrivialDefendDrawPosition(raw)) {
      logRejected(raw.id, 'trivial / no practical pressure');
      continue;
    }
    if (!isEligibleDefendDrawPosition(raw)) {
      logRejected(raw.id, 'failed eligibility');
      continue;
    }
    out.push(toCertified(raw));
  }
  return out;
}

export function endgamesForDifficulty(
  difficulty: AnyChessDifficultyId,
): CertifiedEndgamePosition[] {
  return listCertifiedEndgames().filter((p) => p.difficulty === difficulty);
}

/**
 * Select a verified start for the difficulty.
 * Never falls back to an unfiltered / random / trivial position.
 */
export function getDefendDrawPosition(
  difficulty: AnyChessDifficultyId,
  recentIds: string[] = [],
  rng: () => number = Math.random,
): CertifiedEndgamePosition {
  const pool = endgamesForDifficulty(difficulty);
  if (pool.length === 0) {
    throw new DefendDrawPoolEmptyError(difficulty);
  }

  const fresh = pool.filter((p) => !recentIds.includes(p.id));
  const use = fresh.length > 0 ? fresh : pool;

  // Prefer tighter holds (lower drawingMoves / legalMoves) with light randomness.
  const scored = [...use].sort((a, b) => {
    const pa = a.drawingMoves / Math.max(1, a.legalMoves);
    const pb = b.drawingMoves / Math.max(1, b.legalMoves);
    return pa - pb;
  });
  const window = Math.max(1, Math.ceil(scored.length * 0.7));
  const candidates = scored.slice(0, window);
  const chosen = candidates[Math.floor(rng() * candidates.length)]!;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      [
        'DefendDraw position',
        `id: ${chosen.id}`,
        `difficulty: ${chosen.difficulty}`,
        `theme: ${chosen.theme}`,
        `fen: ${chosen.fen}`,
        `verifiedDraw: ${chosen.verifiedDraw}`,
        `defender: ${chosen.defenderColor === 'w' ? 'white' : 'black'}`,
      ].join('\n'),
    );
  }

  return chosen;
}

/** @deprecated Prefer getDefendDrawPosition */
export function pickCertifiedEndgame(
  difficulty: AnyChessDifficultyId,
  recentIds: string[] = [],
  rng: () => number = Math.random,
): CertifiedEndgamePosition {
  return getDefendDrawPosition(difficulty, recentIds, rng);
}

/** @deprecated Prefer getDefendDrawPosition */
export function pickDefendDrawPosition(
  difficulty: AnyChessDifficultyId,
  recentIds: string[] = [],
  rng: () => number = Math.random,
): DefendDrawPosition {
  return getDefendDrawPosition(difficulty, recentIds, rng);
}

/** @deprecated Prefer endgamesForDifficulty */
export function positionsForDifficulty(
  difficulty: AnyChessDifficultyId,
): DefendDrawPosition[] {
  return endgamesForDifficulty(difficulty);
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
    return getDefendDrawPosition(difficulty, recentIds, rng);
  }
}

export const endgamePositionRepository = new EndgamePositionRepository();
