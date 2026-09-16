/**
 * Checks that generated theoretical pool artifacts are in sync and valid.
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-theoretical-endgame-pool.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { THEORETICAL_ENDGAME_POOL } from '../lib/theoreticalEndgame/data/pool.generated.ts';
import { LEGACY_THEORETICAL_IDS } from '../lib/theoreticalEndgame/domain/fenLegality.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CANONICAL_PATH = join(ROOT, 'lib/theoreticalEndgame/data/canonical.positions.json');
const POOL_PATH = join(ROOT, 'lib/theoreticalEndgame/data/pool.generated.ts');
const MANIFEST_PATH = join(ROOT, 'lib/theoreticalEndgame/data/pool.manifest.json');

const errors = [];

if (!existsSync(CANONICAL_PATH)) errors.push('missing canonical.positions.json');
if (!existsSync(POOL_PATH)) errors.push('missing pool.generated.ts');
if (!existsSync(MANIFEST_PATH)) errors.push('missing pool.manifest.json');

const canonical = JSON.parse(readFileSync(CANONICAL_PATH, 'utf8'));
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const poolSource = readFileSync(POOL_PATH, 'utf8');

if (!poolSource.includes('AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY')) {
  errors.push('pool.generated.ts missing AUTO-GENERATED header');
}

const activeCanon = (canonical.positions ?? []).filter((p) => p.active !== false);
const expectedHash = createHash('sha256')
  .update(
    JSON.stringify(
      activeCanon.map((p) => ({ id: p.id, fen: p.initialFen, themeId: p.themeId })),
    ),
  )
  .digest('hex')
  .slice(0, 16);

if (manifest.contentHash !== expectedHash) {
  errors.push(
    `manifest contentHash stale (manifest=${manifest.contentHash}, expected=${expectedHash}) — run theoretical-endgame:build`,
  );
}

if (!poolSource.includes(expectedHash)) {
  errors.push('pool.generated.ts contentHash out of sync with canonical source');
}

const active = THEORETICAL_ENDGAME_POOL.filter((p) => p.active !== false);
if (active.length !== 10) {
  errors.push(`runtime active count ${active.length} !== 10`);
}

for (const id of LEGACY_THEORETICAL_IDS) {
  if (poolSource.includes(`id: '${id}'`) || poolSource.includes(`"${id}"`)) {
    errors.push(`legacy id ${id} found in generated pool`);
  }
}

if (poolSource.includes('three-pawns')) {
  errors.push('three-pawns theme found in generated pool');
}

const validate = spawnSync(
  process.execPath,
  ['--experimental-strip-types', join(__dirname, 'validate-theoretical-endgame-pool.mjs')],
  { cwd: ROOT, encoding: 'utf8' },
);
if (validate.status !== 0) {
  errors.push('validate-theoretical-endgame-pool failed');
  if (validate.stdout) console.log(validate.stdout);
  if (validate.stderr) console.error(validate.stderr);
}

if (errors.length > 0) {
  console.error('theoretical-endgame:check failed:');
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}

console.log('theoretical-endgame:check passed');
console.log(`  active positions: ${active.length}`);
console.log(`  contentHash: ${expectedHash}`);
