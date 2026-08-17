/**
 * Offline pool builder for Défends la nulle.
 *
 *   pnpm build:defend-draw-pool --seed=42
 *   pnpm build:defend-draw-pool --seed=42 --dry-run
 *   pnpm build:defend-draw-pool --seed=42 --max-candidates=200
 */
import { buildDefendDrawPool } from '../lib/defendDraw/builder/poolBuilder.ts';

function parseArgs(argv) {
  let seed = 42;
  let dryRun = false;
  let pauseMs = 35;
  let maxCandidates = undefined;
  let allowStockfish = false;

  for (const arg of argv) {
    if (arg.startsWith('--seed=')) seed = parseInt(arg.slice(7), 10);
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--pause-ms=')) pauseMs = parseInt(arg.slice(11), 10);
    else if (arg.startsWith('--max-candidates=')) {
      maxCandidates = parseInt(arg.slice(17), 10);
    } else if (arg === '--allow-stockfish') allowStockfish = true;
  }

  return { seed, dryRun, pauseMs, maxCandidates, allowStockfish };
}

const args = parseArgs(process.argv.slice(2));

console.log('Défends la nulle — pool builder');
console.log(`seed=${args.seed} dryRun=${args.dryRun} pauseMs=${args.pauseMs}`);
console.log('Certifying candidates via Syzygy (authoring only)…\n');

const report = await buildDefendDrawPool({
  seed: args.seed,
  dryRun: args.dryRun,
  pauseMs: args.pauseMs,
  maxCandidates: args.maxCandidates,
  allowStockfishFallback: args.allowStockfish,
});

console.log(`\nCandidates in pool: ${report.totals.candidates}`);

console.log('\n── Build complete ──');
console.log(`Selected: ${report.totals.selected} / targets ${Object.values(report.targets).reduce((a, b) => a + b, 0)}`);
console.log('By difficulty:', report.byDifficulty);
console.log('By family:', report.byFamily);
console.log('By source:', report.bySource);
console.log('Rejections:', report.rejectionsByReason);
if (report.removed.length) console.log('Removed:', report.removed);
if (report.reclassified.length) console.log('Reclassified:', report.reclassified.slice(0, 10), report.reclassified.length > 10 ? '…' : '');
if (report.familyWarnings.length) console.log('Warnings:', report.familyWarnings);
if (!args.dryRun) console.log('\nWrote lib/defendDraw/data/pool.generated.ts');
