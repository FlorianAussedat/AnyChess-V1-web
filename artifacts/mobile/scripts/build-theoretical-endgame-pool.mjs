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
import { Chess } from 'chess.js';
import {
  validateFenLegality,
  validateThemeMaterial,
  LEGACY_THEORETICAL_IDS,
  REMOVED_THEME_IDS,
  countPieces,
  readablePieces,
} from '../lib/theoreticalEndgame/domain/fenLegality.ts';
import { THEME_IDS } from '../lib/theoreticalEndgame/domain/themes.ts';
import { flipColors, mirrorHorizontal } from '../lib/theoreticalEndgame/transforms/fenTransforms.ts';
import { THEORETICAL_ENDGAME_CONFIG } from '../lib/theoreticalEndgame/domain/types.ts';

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

function proofBlock(proof) {
  const opt = (key, value) =>
    value == null || value === '' ? '' : `, ${key}: ${typeof value === 'number' ? value : `'${esc(String(value))}'`}`;
  const num = (value) => (value == null ? 'null' : value);
  return `{
      method: '${proof.method}',
      confidence: '${proof.confidence}',
      category: '${proof.category}',
      playerResult: '${proof.playerResult}',
      dtz: ${num(proof.dtz)},
      dtm: ${num(proof.dtm)},
      dtmReported: ${num(proof.dtmReported)},
      source: '${proof.source}',
      consultedAt: '${esc(proof.consultedAt)}'${opt('bestMove', proof.bestMove)}${opt('depth', proof.depth)}${opt('centipawn', proof.centipawn)},
    }`;
}

function noteBlock(note) {
  return `{ fr: '${esc(note.fr)}', en: '${esc(note.en)}' }`;
}

function placementKey(fen) {
  return fen.split(' ')[0];
}

const raw = JSON.parse(readFileSync(CANONICAL_PATH, 'utf8'));
const errors = [];

if (raw.expectedActiveCount !== THEORETICAL_ENDGAME_CONFIG.expectedActiveCount) {
  errors.push(
    `expectedActiveCount must be ${THEORETICAL_ENDGAME_CONFIG.expectedActiveCount} (got ${raw.expectedActiveCount})`,
  );
}
if (raw.contentVersion !== THEORETICAL_ENDGAME_CONFIG.contentVersion) {
  errors.push(`contentVersion must be ${THEORETICAL_ENDGAME_CONFIG.contentVersion}`);
}
if (raw.datasetVersion !== THEORETICAL_ENDGAME_CONFIG.datasetVersion) {
  errors.push(`datasetVersion must stay ${THEORETICAL_ENDGAME_CONFIG.datasetVersion} so history is not wiped`);
}

const active = (raw.positions ?? []).filter((p) => p.active !== false);
if (active.length !== THEORETICAL_ENDGAME_CONFIG.expectedActiveCount) {
  errors.push(
    `active positions must be exactly ${THEORETICAL_ENDGAME_CONFIG.expectedActiveCount} (got ${active.length}) — unverified positions must stay out`,
  );
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
  themeSeen.add(pos.themeId);

  const stm = pos.initialFen.split(' ')[1] === 'b' ? 'black' : 'white';
  if (pos.playerColor !== stm) {
    errors.push(`${pos.id}: playerColor ${pos.playerColor} must match side to move (${stm})`);
  }
  if (pos.diagramOrientation !== pos.playerColor) {
    errors.push(`${pos.id}: diagramOrientation must match the user`);
  }
  if (!pos.objectiveKind || !pos.proof || !pos.variantNote?.fr || !pos.variantNote?.en) {
    errors.push(`${pos.id}: objectiveKind, proof and variantNote are required`);
  }
  if (pos.contentVersion !== 'variants-v2') {
    errors.push(`${pos.id}: contentVersion must be variants-v2`);
  }
  if (pos.targetUserMoves != null) {
    errors.push(`${pos.id}: targetUserMoves is removed from this mode`);
  }

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
  if (pieces <= 7 && pos.proof?.confidence !== 'exact') {
    errors.push(`${pos.id}: <=7 pieces requires an exact tablebase proof`);
  }
  if (pieces > 7 && (pos.certification?.type !== 'ENGINE' || pos.certification?.depth !== 16)) {
    errors.push(`${pos.id}: >7 pieces requires ENGINE depth 16, labeled not exact`);
  }
  if (pieces > 7 && pos.proof?.confidence !== 'engine') {
    errors.push(`${pos.id}: engine proof must not be labeled exact`);
  }
  if (!pos.proof?.category || !pos.proof?.source || !pos.proof?.method) {
    errors.push(`${pos.id}: proof needs category, source and method`);
  }
  if (pos.proof?.confidence === 'exact' && pos.proof?.category === 'draw' && pos.proof?.dtm != null) {
    errors.push(`${pos.id}: an exact draw has no mate distance; dtm must be null`);
  }
  if (pos.proof?.confidence === 'exact' && pos.proof?.category === 'win' && !(pos.proof?.dtm > 0)) {
    errors.push(`${pos.id}: an exact win requires a positive mate distance`);
  }
  if (pos.proof?.confidence === 'engine' && pos.proof?.dtm != null) {
    errors.push(`${pos.id}: an engine centipawn search must not be stored as a mate distance`);
  }

  try {
    const game = new Chess(pos.initialFen);
    if (game.isCheckmate() || game.isStalemate() || game.isGameOver()) {
      errors.push(`${pos.id}: starting position is already terminal`);
    }
  } catch (err) {
    errors.push(`${pos.id}: chess.js ${err.message}`);
  }

  if (!pos.explanation?.fr || !pos.explanation?.en) {
    errors.push(`${pos.id}: bilingual explanation required`);
  }
}

for (const themeId of THEME_IDS) {
  const count = active.filter((p) => p.themeId === themeId).length;
  const min = themeId === 'pawn-square' ? 6 : 3;
  if (count < min) errors.push(`theme ${themeId} needs at least ${min} active variants (got ${count})`);
}

const byTheme = new Map();
for (const pos of active) {
  const list = byTheme.get(pos.themeId) ?? [];
  list.push(pos);
  byTheme.set(pos.themeId, list);
}
for (const [themeId, list] of byTheme) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = placementKey(list[i].initialFen);
      const b = placementKey(list[j].initialFen);
      let mirror = '';
      let flipped = '';
      try {
        mirror = placementKey(mirrorHorizontal(list[j].initialFen));
      } catch {
        mirror = '';
      }
      try {
        flipped = placementKey(flipColors(list[j].initialFen));
      } catch {
        flipped = '';
      }
      if (a === b || (mirror && a === mirror) || (flipped && a === flipped)) {
        errors.push(`${list[i].id} and ${list[j].id}: variants in ${themeId} must not be copies, mirrors, or color swaps`);
      }
    }
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
    objectiveKind: '${pos.objectiveKind}',
    completion: { type: '${pos.completion.type}' },
    certification: ${certificationBlock(pos.certification)},
    proof: ${proofBlock(pos.proof)},
    contentVersion: '${esc(pos.contentVersion)}',
    variantNote: ${noteBlock(pos.variantNote)},
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
  expectedActiveCount: active.length,
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
