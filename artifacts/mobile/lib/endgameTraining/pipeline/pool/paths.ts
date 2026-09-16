/**
 * Canonical paths for endgame pool data layers.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ENDGAME_DATA_DIR = join(here, '../../data');
export const MOBILE_ROOT = join(here, '../../../..');

export const PATHS = {
  candidates: join(ENDGAME_DATA_DIR, 'candidates.generated.json'),
  curation: join(ENDGAME_DATA_DIR, 'curation.json'),
  manual: join(ENDGAME_DATA_DIR, 'manual.positions.json'),
  poolGenerated: join(ENDGAME_DATA_DIR, 'pool.generated.ts'),
  manifest: join(ENDGAME_DATA_DIR, 'pool.manifest.json'),
  metadata: join(ENDGAME_DATA_DIR, 'poolMetadata.ts'),
  poolReport: join(MOBILE_ROOT, 'data', 'endgame-training-pool-report.json'),
  reviewHtml: join(MOBILE_ROOT, 'data', 'endgame-training-review.html'),
  cacheDir: join(MOBILE_ROOT, 'scripts', '.cache'),
} as const;
