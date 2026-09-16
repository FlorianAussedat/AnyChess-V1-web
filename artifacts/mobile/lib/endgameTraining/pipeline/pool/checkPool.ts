/**
 * Deterministic check — rebuild and compare pool.generated.ts only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildEndgamePool } from './buildPool.ts';
import { validateEndgamePool } from './validatePool.ts';
import { PATHS } from './paths.ts';
import { computeContentVersion } from './contentVersion.ts';
import { ENDGAME_TRAINING_POOL } from '../../data/pool.generated.ts';

export function checkPoolDeterminism(): { ok: boolean; message: string } {
  const poolSrc = readFileSync(PATHS.poolGenerated, 'utf8');
  const manifestSrc = readFileSync(PATHS.manifest, 'utf8');
  const parsedManifest = JSON.parse(manifestSrc) as {
    contentVersion: string;
    activeCount: number;
  };

  buildEndgamePool({});

  const poolAfter = readFileSync(PATHS.poolGenerated, 'utf8');
  const manifestAfter = JSON.parse(readFileSync(PATHS.manifest, 'utf8')) as {
    contentVersion: string;
    activeCount: number;
  };

  // Restore pool if build changed formatting only
  if (poolAfter !== poolSrc) {
    writeFileSync(PATHS.poolGenerated, poolSrc, 'utf8');
    return { ok: false, message: 'pool.generated.ts is stale — run pnpm endgame-pool:build' };
  }

  const computed = computeContentVersion(ENDGAME_TRAINING_POOL);
  if (parsedManifest.contentVersion !== computed) {
    return {
      ok: false,
      message: `contentVersion mismatch: manifest=${parsedManifest.contentVersion} computed=${computed}`,
    };
  }

  if (manifestAfter.contentVersion !== parsedManifest.contentVersion) {
    return { ok: false, message: 'Non-deterministic contentVersion across builds' };
  }

  if (manifestAfter.activeCount !== ENDGAME_TRAINING_POOL.length) {
    return { ok: false, message: 'activeCount mismatch' };
  }

  return { ok: true, message: 'Pool artifacts are up to date.' };
}

export function runPoolCheck(): { ok: boolean; message: string } {
  const det = checkPoolDeterminism();
  if (!det.ok) return det;
  const val = validateEndgamePool(false);
  if (!val.ok) {
    return { ok: false, message: val.errors.join('; ') };
  }
  return { ok: true, message: `${det.message} Validation passed.` };
}
