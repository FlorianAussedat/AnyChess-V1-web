/**
 * Development report: Syzygy drawing-move metrics for the certified pool.
 * Does NOT rewrite difficulty — human classification stays in positions.ts.
 *
 *   pnpm analyze:defend-draw
 */
import { CERTIFIED_DEFEND_DRAW_POSITIONS } from '../lib/defendDraw/positions.ts';
import { analyzeDrawingWalk } from '../lib/defendDraw/analyzeDifficulty.ts';

const pad = (s, n) => String(s).padEnd(n);

console.log('Défends la nulle — difficulty analysis (Syzygy walk)');
console.log('This script reports metrics only. It never rewrites difficulty.\n');

const byDiff = {};
const byFamily = {};
let failed = 0;
const rows = [];

for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
  byDiff[p.difficulty] = (byDiff[p.difficulty] || 0) + 1;
  byFamily[p.family] = (byFamily[p.family] || 0) + 1;

  const metrics = await analyzeDrawingWalk(p.fen, { plyDepth: 3, pauseMs: 70 });
  if (!metrics) {
    failed += 1;
    console.log(`${p.id}`);
    console.log(`family: ${p.family}`);
    console.log(`difficulty: ${p.difficulty}`);
    console.log('tablebase: unavailable\n');
    rows.push({
      id: p.id,
      family: p.family,
      difficulty: p.difficulty,
      concepts: p.concepts.join(', '),
      drawLeg: `${p.drawingMoves}/${p.legalMoves}`,
      ratio: 'n/a',
      crit: 'n/a',
    });
    continue;
  }

  const ratioPct = `${(metrics.drawingRatio * 100).toFixed(1)}%`;
  console.log(`${p.id}`);
  console.log(`family: ${p.family}`);
  console.log(`difficulty: ${p.difficulty}`);
  console.log('');
  console.log(`legal moves: ${metrics.legalMoves}`);
  console.log(`drawing moves: ${metrics.drawingMoves}`);
  console.log(`losing moves: ${metrics.losingMoves}`);
  console.log(`drawing ratio: ${ratioPct}`);
  console.log(`critical defensive decisions: ${metrics.criticalMoves}`);
  console.log('');

  rows.push({
    id: p.id,
    family: p.family,
    difficulty: p.difficulty,
    concepts: p.concepts.join(', '),
    drawLeg: `${metrics.drawingMoves}/${metrics.legalMoves}`,
    ratio: ratioPct,
    crit: String(metrics.criticalMoves),
  });
}

console.log('── Summary table ──');
console.log(
  [
    pad('ID', 8),
    pad('Family', 13),
    pad('Concepts', 42),
    pad('Difficulty', 12),
    pad('Draw/Legal', 12),
    pad('Ratio', 8),
    pad('Crit', 5),
  ].join(' '),
);
console.log('-'.repeat(110));
for (const r of rows) {
  console.log(
    [
      pad(r.id, 8),
      pad(r.family, 13),
      pad(r.concepts, 42),
      pad(r.difficulty, 12),
      pad(r.drawLeg, 12),
      pad(r.ratio, 8),
      r.crit,
    ].join(' '),
  );
}

console.log('\n── Counts by difficulty ──');
console.log(byDiff);
console.log('── Counts by family ──');
console.log(byFamily);
if (failed) console.log(`TB misses: ${failed}`);
console.log('\nDone. Difficulty was not modified.');
