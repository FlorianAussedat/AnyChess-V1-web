#!/usr/bin/env node
/**
 * pnpm endgame-pool:review
 */
import { writeReviewHtml } from '../../lib/endgameTraining/pipeline/pool/reviewHtml.ts';
import { PATHS } from '../../lib/endgameTraining/pipeline/pool/paths.ts';

writeReviewHtml();
console.log(`Review HTML written to ${PATHS.reviewHtml}`);
