import type { DefendDrawPosition } from '../positions.ts';
import type { AnyChessDifficultyId } from '../../difficulty/anyChessDifficulty.ts';
import type { EndgameFamily } from '../taxonomy.ts';
import type { PoolTargets } from './candidateTypes.ts';

export type ReselectRow = DefendDrawPosition & {
  suggestedDifficulty: AnyChessDifficultyId;
  fenKey: string;
};

function scoreForBand(row: ReselectRow, band: AnyChessDifficultyId): number {
  let score = row.suggestedDifficulty === band ? 10 : 0;
  const ratio = row.difficultyMetrics?.drawingRatio ?? 0.5;
  if (band === 'debutant' && ratio >= 0.4) score += 2;
  if (band === 'grandMaitre' || band === 'expert') {
    score += (row.difficultyMetrics?.uniqueMoveMoments ?? 0) * 3;
    if (ratio < 0.3) score += 3;
    if (row.family === 'imbalanced' || row.family === 'fortress') score += 2;
  }
  return score;
}

/** Pick targets prioritising suggested band, then family variety. */
export function reselectFromCertifiedRows(
  certified: ReselectRow[],
  targets: PoolTargets,
): DefendDrawPosition[] {
  const selected: DefendDrawPosition[] = [];
  const usedFen = new Set<string>();
  const fillOrder = ['grandMaitre', 'expert', 'confirme', 'debutant'] as const;
  const difficultyOrder = ['debutant', 'confirme', 'expert', 'grandMaitre'] as const;

  for (const band of fillOrder) {
    const target = targets[band];
    const familyCounts: Record<string, number> = {};
    let picked = 0;

    while (picked < target) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < certified.length; i++) {
        const row = certified[i]!;
        if (usedFen.has(row.fenKey)) continue;
        const si = difficultyOrder.indexOf(row.suggestedDifficulty);
        const bi = difficultyOrder.indexOf(band);
        const bandDist = Math.abs(si - bi);
        const maxDist = band === 'grandMaitre' ? 3 : band === 'expert' ? 2 : 1;
        if (bandDist > maxDist && picked < target * 0.5) continue;

        let score = 30 - bandDist * 10;
        score += scoreForBand(row, band);
        if (band === 'grandMaitre') {
          if ((row.drawingMoves ?? 0) > 2 && (row.difficultyMetrics?.drawingRatio ?? 1) > 0.35) {
            score -= 25;
          }
          if (row.drawingMoves === 1) score += 8;
          if ((row.difficultyMetrics?.uniqueMoveMoments ?? 0) >= 1) score += 6;
          if (row.family === 'imbalanced' || row.family === 'queen') score += 5;
        }
        score -= (familyCounts[row.family] ?? 0) * 2;
        const recent = selected.filter((s) => s.difficulty === band).slice(-2);
        if (recent.length === 2 && recent.every((r) => r.family === row.family)) {
          score -= 8;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) break;
      const row = certified[bestIdx]!;
      const { suggestedDifficulty: _s, fenKey, ...pos } = row;
      selected.push({ ...pos, difficulty: band });
      usedFen.add(fenKey);
      familyCounts[row.family] = (familyCounts[row.family] ?? 0) + 1;
      picked += 1;
    }
  }

  return selected.sort((a, b) => a.id.localeCompare(b.id));
}

export { scoreForBand };
