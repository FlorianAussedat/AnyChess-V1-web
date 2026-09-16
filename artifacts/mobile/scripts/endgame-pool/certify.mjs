#!/usr/bin/env node
/**
 * pnpm endgame-pool:certify
 */
import { runCertification } from '../../lib/endgameTraining/pipeline/pool/runCertify.ts';

function parseArgs(argv) {
  let limit = undefined;
  let pauseMs = 100;
  let autoAccept = false;
  let retryUnknown = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit' && argv[i + 1]) limit = parseInt(argv[++i], 10);
    else if (a.startsWith('--limit=')) limit = parseInt(a.slice(8), 10);
    else if (a === '--pause-ms' && argv[i + 1]) pauseMs = parseInt(argv[++i], 10);
    else if (a === '--auto-accept') autoAccept = true;
    else if (a === '--retry-unknown') retryUnknown = true;
  }
  return { limit, pauseMs, autoAccept, retryUnknown };
}

const args = parseArgs(process.argv.slice(2));
console.log('Endgame pool certification (Syzygy move−1)…');
const report = await runCertification({
  limit: args.limit,
  pauseMs: args.pauseMs,
  autoAccept: args.autoAccept,
  reviewer: 'pipeline-auto',
  retryUnknown: args.retryUnknown,
});
console.log(JSON.stringify(report, null, 2));
