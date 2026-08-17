/**
 * Variety-aware pick among certified positions of one difficulty.
 * Avoids repeating the same family when alternatives exist.
 * Never falls back to an uncertified FEN.
 */
import type { CertifiedEndgamePosition } from './EndgamePositionRepository.ts';
import type { EndgameFamily } from './taxonomy.ts';

export type VarietyPickContext = {
  recentIds?: string[];
  recentFamilies?: EndgameFamily[];
};

function familyOf(p: CertifiedEndgamePosition): EndgameFamily {
  return p.family;
}

/**
 * Weighted pick: down-weight families seen recently, then light RNG.
 * Pool must already be difficulty-filtered + certified.
 */
export function pickVariedCertifiedPosition(
  pool: readonly CertifiedEndgamePosition[],
  rng: () => number,
  recentIds: string[] = [],
  recentFamilies: EndgameFamily[] = [],
): CertifiedEndgamePosition {
  if (pool.length === 0) {
    throw new Error('[DefendDraw] pickVariedCertifiedPosition called with empty pool');
  }

  const fresh = pool.filter((p) => !recentIds.includes(p.id));
  const use = fresh.length > 0 ? fresh : [...pool];

  const lastFamily = recentFamilies[0];
  const avoided = new Set(recentFamilies.slice(0, 3));

  const diverse = lastFamily
    ? use.filter((p) => familyOf(p) !== lastFamily)
    : use;
  const notRecentFamily = use.filter((p) => !avoided.has(familyOf(p)));

  let candidates = diverse.length > 0 ? diverse : use;
  if (notRecentFamily.length > 0 && notRecentFamily.length < use.length) {
    candidates = notRecentFamily;
  }

  return candidates[Math.floor(rng() * candidates.length)]!;
}
