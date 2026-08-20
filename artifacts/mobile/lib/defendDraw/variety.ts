/**
 * Variety-aware pick among certified positions of one difficulty.
 * Avoids repeating the same family / material signature when alternatives exist.
 * Never falls back to an uncertified FEN.
 */
import type { CertifiedEndgamePosition } from './EndgamePositionRepository.ts';
import type { EndgameFamily } from './taxonomy.ts';
import { materialSignature } from './materialSignature.ts';
import type { EndgameTrainingStyle } from './qualityConfig.ts';

export type VarietyPickContext = {
  recentIds?: string[];
  recentFamilies?: EndgameFamily[];
  recentMaterialSignatures?: string[];
  recentStyles?: EndgameTrainingStyle[];
};

function familyOf(p: CertifiedEndgamePosition): EndgameFamily {
  return p.family;
}

function matOf(p: CertifiedEndgamePosition): string {
  return p.materialSignature ?? materialSignature(p.fen);
}

function styleOf(p: CertifiedEndgamePosition): EndgameTrainingStyle {
  return p.trainingStyle ?? 'practical';
}

/**
 * Weighted pick: down-weight families / material / styles seen recently.
 * Pool must already be difficulty-filtered + certified.
 */
export function pickVariedCertifiedPosition(
  pool: readonly CertifiedEndgamePosition[],
  rng: () => number,
  recentIds: string[] = [],
  recentFamilies: EndgameFamily[] = [],
  recentMaterialSignatures: string[] = [],
  recentStyles: EndgameTrainingStyle[] = [],
): CertifiedEndgamePosition {
  if (pool.length === 0) {
    throw new Error('[DefendDraw] pickVariedCertifiedPosition called with empty pool');
  }

  const fresh = pool.filter((p) => !recentIds.includes(p.id));
  const use = fresh.length > 0 ? fresh : [...pool];

  const lastFamily = recentFamilies[0];
  const avoidedFamilies = new Set(recentFamilies.slice(0, 3));
  const avoidedMat = new Set(recentMaterialSignatures.slice(0, 3));
  const lastStyle = recentStyles[0];

  let candidates = use;

  const notSameFamily = lastFamily
    ? candidates.filter((p) => familyOf(p) !== lastFamily)
    : candidates;
  if (notSameFamily.length > 0) candidates = notSameFamily;

  const notRecentFamily = candidates.filter((p) => !avoidedFamilies.has(familyOf(p)));
  if (notRecentFamily.length > 0) candidates = notRecentFamily;

  const notSameMat = candidates.filter((p) => !avoidedMat.has(matOf(p)));
  if (notSameMat.length > 0) candidates = notSameMat;

  if (lastStyle) {
    const otherStyle = candidates.filter((p) => styleOf(p) !== lastStyle);
    if (otherStyle.length > 0) candidates = otherStyle;
  }

  return candidates[Math.floor(rng() * candidates.length)]!;
}
