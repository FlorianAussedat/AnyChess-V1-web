#!/usr/bin/env node
/**
 * pnpm endgame-pool:build
 */
import { buildEndgamePool, writePoolMetadata } from '../../lib/endgameTraining/pipeline/pool/buildPool.ts';
import { ENDGAME_POOL_DATASET_VERSION } from '../../lib/endgameTraining/data/poolMetadata.ts';

const production = process.argv.includes('--production');

console.log('Building endgame training pool…');
const { positions, manifest, report } = buildEndgamePool({
  requireProduction: production,
});

writePoolMetadata(`lichess-pool-v${ENDGAME_POOL_DATASET_VERSION}-${manifest.activeCount}`);

console.log(`Active positions: ${positions.length}`);
console.log(`contentVersion: ${manifest.contentVersion}`);
console.log(JSON.stringify(report, null, 2));

if (production && positions.length < 80) {
  console.warn(`Warning: production build has ${positions.length} positions (target 80–150).`);
}
