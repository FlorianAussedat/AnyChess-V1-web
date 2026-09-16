#!/usr/bin/env node
/**
 * pnpm endgame-pool:import
 */
import { importLichessCandidates } from '../../lib/endgameTraining/pipeline/pool/importCandidates.ts';

function parseArgs(argv) {
  let input = null;
  let seed = 'anychess-v1';
  let maxCandidates = 1000;
  let maxRows = undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--input' || a === '-i') && argv[i + 1]) input = argv[++i];
    else if (a.startsWith('--input=')) input = a.slice(8);
    else if (a === '--seed' && argv[i + 1]) seed = argv[++i];
    else if (a.startsWith('--seed=')) seed = a.slice(7);
    else if (a === '--max-candidates' && argv[i + 1]) maxCandidates = parseInt(argv[++i], 10);
    else if (a.startsWith('--max-candidates=')) maxCandidates = parseInt(a.slice(17), 10);
    else if (a === '--max-rows' && argv[i + 1]) maxRows = parseInt(argv[++i], 10);
    else if (a.startsWith('--max-rows=')) maxRows = parseInt(a.slice(11), 10);
  }
  return { input, seed, maxCandidates, maxRows };
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  console.error(`Usage: pnpm endgame-pool:import -- --input /path/lichess_db_puzzle.csv.zst [--seed anychess-v1] [--max-candidates 1000] [--max-rows N]`);
  process.exit(1);
}

console.log('Endgame pool import…');
const { file, report } = await importLichessCandidates({
  input: args.input,
  seed: args.seed,
  maxCandidates: args.maxCandidates,
  maxRows: args.maxRows,
});

console.log(JSON.stringify(report, null, 2));
console.log(`Total candidates in file: ${file.candidates.length}`);
