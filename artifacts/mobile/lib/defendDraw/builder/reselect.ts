import type { DefendDrawPosition } from '../positions.ts';
import type { AnyChessDifficultyId } from '../../difficulty/anyChessDifficulty.ts';
import type { PoolTargets } from './candidateTypes.ts';
import { ENDGAME_QUALITY_CONFIG } from '../qualityConfig.ts';
import { similarityKey } from '../materialSignature.ts';

export type ReselectRow = DefendDrawPosition & {
  suggestedDifficulty: AnyChessDifficultyId;
  fenKey: string;
};

/**
 * Score how well a row fits its *suggested* band (for reporting / soft ranking).
 * Does NOT move positions across bands to fill quotas.
 */
export function scoreForBand(row: ReselectRow, band: AnyChessDifficultyId): number {
  let score = row.suggestedDifficulty === band ? 10 : 0;
  const ratio = row.difficultyMetrics?.drawingRatio ?? 0.5;
  if (band === 'debutant' && ratio >= 0.4) score += 2;
  if (band === 'grandMaitre' || band === 'expert') {
    score += (row.difficultyMetrics?.uniqueMoveMoments ?? 0) * 3;
    if (ratio < 0.3) score += 3;
    if (row.family === 'imbalanced' || row.family === 'fortress') score += 1;
  }
  return score;
}

/**
 * Select certified rows into the pool.
 *
 * Targets are soft maxima / indicative goals — never an obligation.
 * A position keeps its suggestedDifficulty; it is never reassigned solely
 * to fill a quota. Quality before quantity.
 */
export function reselectFromCertifiedRows(
  certified: ReselectRow[],
  targets: PoolTargets,
): DefendDrawPosition[] {
  const selected: DefendDrawPosition[] = [];
  const usedFen = new Set<string>();
  const usedSimilarity = new Map<string, number>();
  const bandCounts: Record<AnyChessDifficultyId, number> = {
    debutant: 0,
    confirme: 0,
    expert: 0,
    grandMaitre: 0,
  };
  const familyByBand: Record<AnyChessDifficultyId, Record<string, number>> = {
    debutant: {},
    confirme: {},
    expert: {},
    grandMaitre: {},
  };

  // Rank within each suggested band by pedagogical score — never cross-fill.
  const bySuggested: Record<AnyChessDifficultyId, ReselectRow[]> = {
    debutant: [],
    confirme: [],
    expert: [],
    grandMaitre: [],
  };
  for (const row of certified) {
    bySuggested[row.suggestedDifficulty].push(row);
  }

  for (const band of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
    const candidates = bySuggested[band]
      .slice()
      .sort((a, b) => scoreForBand(b, band) - scoreForBand(a, band));

    const softMax = targets[band];

    for (const row of candidates) {
      if (usedFen.has(row.fenKey)) continue;
      if (bandCounts[band] >= softMax) break;

      const sim = [
        row.materialSignature ?? similarityKey({
          fen: row.fen,
          family: row.family,
          playerColor: row.playerColor,
          theme: row.theme,
          trainingStyle: row.trainingStyle,
        }).split('|')[0],
        row.family,
        row.playerColor,
        row.trainingStyle ?? 'practical',
      ].join('|');
      const simCount = usedSimilarity.get(`${band}|${sim}`) ?? 0;
      if (simCount >= ENDGAME_QUALITY_CONFIG.maxSimilarPerBand) continue;

      const famCounts = familyByBand[band];
      const famCount = famCounts[row.family] ?? 0;
      const nextTotal = bandCounts[band] + 1;
      if (
        nextTotal >= 4 &&
        (famCount + 1) / nextTotal > ENDGAME_QUALITY_CONFIG.maxFamilySharePerBand
      ) {
        // Skip if another family still available in this band
        const hasAlt = candidates.some((c) => {
          if (usedFen.has(c.fenKey)) return false;
          if (c.family === row.family) return false;
          const s = [
            c.materialSignature ?? 'x',
            c.family,
            c.playerColor,
            c.trainingStyle ?? 'practical',
          ].join('|');
          return (usedSimilarity.get(`${band}|${s}`) ?? 0) < ENDGAME_QUALITY_CONFIG.maxSimilarPerBand;
        });
        if (hasAlt) continue;
      }

      const { suggestedDifficulty: _s, fenKey, ...pos } = row;
      selected.push({ ...pos, difficulty: band });
      usedFen.add(fenKey);
      usedSimilarity.set(`${band}|${sim}`, simCount + 1);
      famCounts[row.family] = famCount + 1;
      bandCounts[band] += 1;
    }
  }

  return selected.sort((a, b) => a.id.localeCompare(b.id));
}
