#!/usr/bin/env node
/**
 * pnpm endgame-pool:check
 */
import { runPoolCheck } from '../../lib/endgameTraining/pipeline/pool/checkPool.ts';

const result = runPoolCheck();
if (!result.ok) {
  console.error(result.message);
  process.exit(1);
}
console.log(result.message);
