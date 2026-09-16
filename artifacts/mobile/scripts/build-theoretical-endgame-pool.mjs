/**
 * Builds pool.generated.ts + pool.manifest.json from canonical.positions.json.
 *
 * Usage:
 *   node --experimental-strip-types scripts/build-theoretical-endgame-pool.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateFenLegality,
  validateThemeMaterial,
  LEGACY_THEORETICAL_IDS,
  REMOVED_THEME_IDS,
  countPieces,
  readablePieces,
} from '../lib/theoreticalEndgame/domain/fenLegality.ts';
import { THEME_IDS } from '../lib/theoreticalEndgame/domain/themes.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CANONICAL_PATH = join(ROOT, 'lib/theoreticalEndgame/data/canonical.positions.json');
const POOL_PATH = join(ROOT, 'lib/theoreticalEndgame/data/pool.generated.ts');
const MANIFEST_PATH = join(ROOT, 'lib/theoreticalEndgame/data/pool.manifest.json');

function esc(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function explanationBlock(expl) {
  const lang = (code) => `{
        principle: '${esc(expl[code].principle)}',
        seek: '${esc(expl[code].seek)}',
        method: '${esc(expl[code].method)}',
        avoid: '${esc(expl[code].avoid)}',
      }`;
  return `{
      fr: ${lang('fr')},
      en: ${lang('en')},
    }`;
}

function certificationBlock(cert) {
  if (cert.type === 'SYZYGY') {
    return `{ type: 'SYZYGY', result: '${cert.result}' }`;
  }
  return `{ type: 'ENGINE', engine: '${esc(cert.engine)}', depth: ${cert.depth}, result: '${cert.result}' }`;
}

const raw = JSON.parse(readFileSync(CANONICAL_PATH, 'utf8'));
const errors = [];

if (raw.expectedActiveCount !== 10) {
  errors.push(`expectedActiveCount must be 10 for this version (got ${raw.expectedActiveCount})`);
}

const active = (raw.positions ?? []).filter((p) => p.active !== false);
if (active.length !== 10) {
  errors.push(`active positions must be exactly 10 (got ${active.length}) — refusing to publish`);
}

const themeSeen = new Set();
const ids = new Set();
const fens = new Set();

for (const pos of active) {
  if (ids.has(pos.id)) errors.push(`duplicate id ${pos.id}`);
  ids.add(pos.id);
  if (LEGACY_THEORETICAL_IDS.includes(pos.id)) {
    errors.push(`legacy id reintroduced: ${pos.id}`);
  }
  if (!String(pos.id).startsWith('TE-CANON-')) {
    errors.push(`${pos.id}: canonical ids must start with TE-CANON-`);
  }
  if (REMOVED_THEME_IDS.includes(pos.themeId)) {
    errors.push(`${pos.id}: removed theme ${pos.themeId}`);
  }
  if (!THEME_IDS.includes(pos.themeId)) {
    errors.push(`${pos.id}: unknown theme ${pos.themeId}`);
  }
  if (themeSeen.has(pos.themeId)) {
    errors.push(`theme ${pos.themeId} has more than one active position in this version`);
  }
  themeSeen.add(pos.themeId);

  const fenKey = pos.initialFen.split(' ').slice(0, 4).join(' ');
  if (fens.has(fenKey)) errors.push(`${pos.id}: duplicate FEN`);
  fens.add(fenKey);

  const legality = validateFenLegality(pos.initialFen);
  if (!legality.ok) {
    for (const e of legality.errors) errors.push(`${pos.id}: ${e}`);
  }

  const material = validateThemeMaterial(pos.themeId, pos.initialFen);
  if (!material.ok) {
    for (const e of material.errors) errors.push(`${pos.id}: ${e}`);
  }

  if (pos.certification?.result !== pos.objective) {
    errors.push(`${pos.id}: certification.result must match objective`);
  }

  const pieces = countPieces(pos.initialFen);
  if (pieces <= 7 && pos.certification?.type !== 'SYZYGY') {
    errors.push(`${pos.id}: <=7 pieces requires SYZYGY`);
  }
  if (pieces > 7 && (pos.certification?.type !== 'ENGINE' || pos.certification?.depth !== 30)) {
    errors.push(`${pos.id}: >7 pieces requires ENGINE depth 30`);
  }

  if (!pos.explanation?.fr || !pos.explanation?.en) {
    errors.push(`${pos.id}: bilingual explanation required`);
  }
}

for (const themeId of THEME_IDS) {
  if (!themeSeen.has(themeId)) {
    errors.push(`missing active position for theme ${themeId}`);
  }
}

if (errors.length > 0) {
  console.error('Build failed:');
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}

const contentHash = createHash('sha256')
  .update(JSON.stringify(active.map((p) => ({ id: p.id, fen: p.initialFen, themeId: p.themeId }))))
  .digest('hex')
  .slice(0, 16);

const positionsTs = active
  .map((pos) => `{
    id: '${esc(pos.id)}',
    themeId: '${pos.themeId}',
    initialFen: '${esc(pos.initialFen)}',
    playerColor: '${pos.playerColor}',
    objective: '${pos.objective}',
    completion: { type: '${pos.completion.type}' },
    targetUserMoves: ${pos.targetUserMoves},
    certification: ${certificationBlock(pos.certification)},
    diagramOrientation: '${pos.diagramOrientation}',
    tags: ${JSON.stringify(pos.tags)},
    active: true,
    explanation: ${explanationBlock(pos.explanation)},
  }`)
  .join(',\n  ');

const file = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Edit canonical.positions.json, then rebuild the pool.
 *
 * Generated by scripts/build-theoretical-endgame-pool.mjs
 * contentHash: ${contentHash}
 * datasetVersion: ${raw.datasetVersion}
 * contentVersion: ${raw.contentVersion}
 */
import type { TheoreticalEndgamePosition } from '../domain/types.ts';

export const THEORETICAL_ENDGAME_POOL: readonly TheoreticalEndgamePosition[] = [
  ${positionsTs},
];
`;

writeFileSync(POOL_PATH, file, 'utf8');

const manifest = {
  generatedAt: new Date().toISOString(),
  datasetVersion: raw.datasetVersion,
  contentVersion: raw.contentVersion,
  contentHash,
  expectedActiveCount: 10,
  activeCount: active.length,
  themes: [...THEME_IDS],
  removedThemes: [...REMOVED_THEME_IDS],
  legacyIdsBanned: LEGACY_THEORETICAL_IDS.length,
  positions: active.map((p) => ({
    id: p.id,
    themeId: p.themeId,
    initialFen: p.initialFen,
    playerColor: p.playerColor,
    sideToMove: p.initialFen.split(' ')[1] === 'b' ? 'black' : 'white',
    objective: p.objective,
    pieceCount: countPieces(p.initialFen),
    pieces: readablePieces(p.initialFen),
    certification: p.certification,
    sourceReferences: p.sourceReferences,
    choiceRationale: p.choiceRationale,
  })),
};

mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Built theoretical endgame pool: ${active.length} active positions`);
console.log(`  contentHash: ${contentHash}`);
console.log(`  pool: ${POOL_PATH}`);
console.log(`  manifest: ${MANIFEST_PATH}`);
