/**
 * Re-select difficulty bands from the current certified pool (no Syzygy).
 */
import { GENERATED_DEFEND_DRAW_POOL } from '../lib/defendDraw/data/pool.generated.ts';
import { normalizeFenKey } from '../lib/defendDraw/builder/fenUtils.ts';
import { inferEndgameFamily, inferEndgameConcepts } from '../lib/defendDraw/builder/inferTaxonomy.ts';
import { suggestDefendDrawDifficulty } from '../lib/defendDraw/builder/suggestDifficulty.ts';
import { writeGeneratedPool, writePositionsWrapper } from '../lib/defendDraw/builder/writePool.ts';
import { DEFAULT_POOL_TARGETS } from '../lib/defendDraw/builder/candidateTypes.ts';
import { reselectFromCertifiedRows } from '../lib/defendDraw/builder/reselect.ts';

const rows = GENERATED_DEFEND_DRAW_POOL.map((p) => {
  const metrics = p.difficultyMetrics
    ? {
        legalMoves: p.difficultyMetrics.legalMoves ?? p.legalMoves,
        drawingMoves: p.difficultyMetrics.drawingMoves ?? p.drawingMoves,
        losingMoves: p.difficultyMetrics.losingMoves ?? 0,
        drawingRatio:
          p.difficultyMetrics.drawingRatio ??
          p.drawingMoves / Math.max(1, p.legalMoves),
        criticalMoves: p.difficultyMetrics.criticalMoves ?? 0,
        uniqueMoveMoments: p.difficultyMetrics.uniqueMoveMoments ?? 0,
      }
    : null;
  const family = p.family ?? inferEndgameFamily(p.fen);
  return {
    ...p,
    family,
    concepts: (p.concepts?.length
      ? p.concepts
      : inferEndgameConcepts(p.fen, family, metrics)) as typeof p.concepts,
    suggestedDifficulty: suggestDefendDrawDifficulty({ fen: p.fen, family, metrics }),
    fenKey: normalizeFenKey(p.fen),
  };
});

const selected = reselectFromCertifiedRows(rows, DEFAULT_POOL_TARGETS);
const byDifficulty = Object.fromEntries(
  ['debutant', 'confirme', 'expert', 'grandMaitre'].map((b) => [
    b,
    selected.filter((p) => p.difficulty === b).length,
  ]),
);
writeGeneratedPool(selected, { reselected: true, byDifficulty });
writePositionsWrapper(selected.length);
console.log('Reselected', selected.length, byDifficulty);
