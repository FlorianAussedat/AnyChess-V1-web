/**
 * CLI: import Lichess puzzle CSV into endgame-training pool (offline).
 *
 *   pnpm import:endgame-training -- --csv path/to/lichess_db_puzzle.csv --limit 50
 *   pnpm import:endgame-training -- --csv sample.csv --ids SYN001,SYN006 --out-pool ... --out-report ...
 *
 * Without --csv, prints usage. Does not ship the full Lichess dump in-repo.
 * Without a real engine analyzer, only structural filters run (see runPipeline).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../lib/endgameTraining/pipeline/runPipeline.ts';
import { writeGeneratedPool } from '../lib/endgameTraining/pipeline/writeGeneratedPool.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..');

function parseArgs(argv) {
  let csv = null;
  let outPool = join(mobileRoot, 'lib/endgameTraining/data/pool.generated.ts');
  let outReport = join(mobileRoot, 'lib/endgameTraining/data/pipeline-report.json');
  let limit = undefined;
  let ids = undefined;
  let minDefensiveMoves = undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--csv' && argv[i + 1]) {
      csv = resolve(argv[++i]);
    } else if (a.startsWith('--csv=')) {
      csv = resolve(a.slice(6));
    } else if (a === '--out-pool' && argv[i + 1]) {
      outPool = resolve(argv[++i]);
    } else if (a.startsWith('--out-pool=')) {
      outPool = resolve(a.slice(11));
    } else if (a === '--out-report' && argv[i + 1]) {
      outReport = resolve(argv[++i]);
    } else if (a.startsWith('--out-report=')) {
      outReport = resolve(a.slice(13));
    } else if (a === '--limit' && argv[i + 1]) {
      limit = parseInt(argv[++i], 10);
    } else if (a.startsWith('--limit=')) {
      limit = parseInt(a.slice(8), 10);
    } else if (a === '--ids' && argv[i + 1]) {
      ids = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a.startsWith('--ids=')) {
      ids = a.slice(6).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--min-defensive-moves' && argv[i + 1]) {
      minDefensiveMoves = parseInt(argv[++i], 10);
    } else if (a === '--dry-run') {
      dryRun = true;
    }
  }

  return { csv, outPool, outReport, limit, ids, minDefensiveMoves, dryRun };
}

const args = parseArgs(process.argv.slice(2));

if (!args.csv) {
  console.error(`Usage:
  node --experimental-strip-types scripts/import-lichess-endgame-training.mjs \\
    --csv <path> [--out-pool <path>] [--out-report <path>] [--limit N] [--ids id1,id2] [--dry-run]

Example fixture:
  --csv lib/endgameTraining/pipeline/__fixtures__/sample-lichess.csv --limit 10 --dry-run

Note: .zst files require zstd on PATH (or decompress to .csv first).
The committed pool.generated.ts is the Syzygy quality seed — do not overwrite casually.`);
  process.exit(1);
}

console.log('Endgame training — Lichess offline import');
console.log(`csv=${args.csv}`);
console.log(`limit=${args.limit ?? '∞'} ids=${args.ids?.join(',') ?? '(all)'} dryRun=${args.dryRun}`);

const { positions, report } = await runPipeline({
  csvPath: args.csv,
  limit: args.limit,
  ids: args.ids,
  minDefensiveMoves: args.minDefensiveMoves,
});

console.log(`Analyzed: ${report.candidatesAnalyzed}`);
console.log(`Accepted: ${report.candidatesAccepted}`);
console.log(`Duplicates removed: ${report.duplicatesRemoved}`);
console.log('Rejections:', report.rejectionReasons);
console.log('Families:', report.familyDistribution);
console.log(`Analysis time: ${report.analysisTimeMs}ms`);

if (args.dryRun) {
  console.log('\nDry run — not writing pool/report.');
} else {
  const written = writeGeneratedPool({
    poolPath: args.outPool,
    reportPath: args.outReport,
    positions,
    report,
  });
  console.log(`\nWrote ${written.poolPath}`);
  console.log(`Wrote ${written.reportPath}`);
}
