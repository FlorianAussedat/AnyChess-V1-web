#!/usr/bin/env node
/**
 * pnpm endgame-pool:validate
 */
import { validateEndgamePool } from '../../lib/endgameTraining/pipeline/pool/validatePool.ts';

const deep = process.argv.includes('--deep');
const result = validateEndgamePool(deep);

if (result.warnings.length) {
  console.warn('Warnings:', result.warnings);
}
if (!result.ok) {
  console.error('Validation failed:');
  for (const e of result.errors) console.error(' -', e);
  process.exit(1);
}
console.log('Pool validation passed.');
