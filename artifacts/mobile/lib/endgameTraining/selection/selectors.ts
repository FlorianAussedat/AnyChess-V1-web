/**
 * Position selection — Nouvelles Finales! and Essaie encore!
 */
import type { EndgameTrainingPosition } from '../domain/types.ts';
import { ENDGAME_TRAINING_POOL } from '../data/pool.generated.ts';

export function isRuntimePoolEmpty(): boolean {
  return ENDGAME_TRAINING_POOL.length === 0;
}

export function listPool(): readonly EndgameTrainingPosition[] {
  return ENDGAME_TRAINING_POOL;
}

export function getPositionById(id: string): EndgameTrainingPosition | null {
  return ENDGAME_TRAINING_POOL.find((p) => p.id === id) ?? null;
}

/**
 * Pick a new unfinished position with variety (family + material signature).
 */
export function pickNewPosition(
  finishedIds: Set<string>,
  recentFamilies: string[] = [],
  recentSignatures: string[] = [],
  rng: () => number = Math.random,
): EndgameTrainingPosition | null {
  if (ENDGAME_TRAINING_POOL.length === 0) return null;
  const fresh = ENDGAME_TRAINING_POOL.filter((p) => !finishedIds.has(p.id));
  if (fresh.length === 0) return null;

  const avoidedFam = new Set(recentFamilies.slice(0, 3));
  const avoidedMat = new Set(recentSignatures.slice(0, 3));

  let candidates = fresh;
  const notFam = candidates.filter((p) => !avoidedFam.has(p.family));
  if (notFam.length > 0) candidates = notFam;
  const notMat = candidates.filter((p) => !avoidedMat.has(p.materialSignature));
  if (notMat.length > 0) candidates = notMat;

  return candidates[Math.floor(rng() * candidates.length)]!;
}

export function pickTryAgainPosition(
  tryAgainIds: string[],
  rng: () => number = Math.random,
): EndgameTrainingPosition | null {
  if (tryAgainIds.length === 0) return null;
  const available = tryAgainIds
    .map((id) => getPositionById(id))
    .filter((p): p is EndgameTrainingPosition => !!p);
  if (available.length === 0) return null;
  return available[Math.floor(rng() * available.length)]!;
}
