/**
 * Validates the theoretical endgame canonical pool and writes the report.
 *
 * Usage:
 *   node --experimental-strip-types scripts/validate-theoretical-endgame-pool.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEORETICAL_ENDGAME_POOL } from '../lib/theoreticalEndgame/data/pool.generated.ts';
import { THEME_IDS } from '../lib/theoreticalEndgame/domain/themes.ts';
import { THEORETICAL_ENDGAME_CONFIG } from '../lib/theoreticalEndgame/domain/types.ts';
import {
  validateFenLegality,
  validateThemeMaterial,
  LEGACY_THEORETICAL_IDS,
  REMOVED_THEME_IDS,
  countPieces,
  readablePieces,
} from '../lib/theoreticalEndgame/domain/fenLegality.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CANONICAL_PATH = join(ROOT, 'lib/theoreticalEndgame/data/canonical.positions.json');
const REPORT_PATH = join(ROOT, 'data/theoretical-endgame-canonical-report.json');
const LEGACY_REPORT_PATH = join(ROOT, 'data/theoretical-endgame-quality-report.json');

const MATE_THEMES = new Set(['queen-mate', 'rook-mate', 'two-bishops-mate']);

const errors = [];
const warnings = [];
const gates = {
  activeCount10: false,
  themes10: false,
  onePerTheme: false,
  noLegacyIds: false,
  noThreePawns: false,
  bothKingsNotInCheck: false,
  materialOk: false,
  certificationOk: false,
  lucenaStructure: false,
  philidorStructure: false,
};

const canonical = JSON.parse(readFileSync(CANONICAL_PATH, 'utf8'));
const active = THEORETICAL_ENDGAME_POOL.filter((p) => p.active !== false);
const themeCounts = Object.fromEntries(THEME_IDS.map((id) => [id, 0]));
const ids = new Set();
const fens = new Set();
let whitePlayer = 0;
let blackPlayer = 0;
let winCount = 0;
let drawCount = 0;
let syzygyCount = 0;
let bothKingsSafe = true;
let materialOk = true;
let certificationOk = true;

for (const pos of active) {
  themeCounts[pos.themeId] = (themeCounts[pos.themeId] ?? 0) + 1;
  if (ids.has(pos.id)) errors.push(`duplicate id: ${pos.id}`);
  ids.add(pos.id);

  if (LEGACY_THEORETICAL_IDS.includes(pos.id)) {
    errors.push(`legacy id present: ${pos.id}`);
  }
  if (REMOVED_THEME_IDS.includes(pos.themeId)) {
    errors.push(`removed theme present: ${pos.themeId}`);
  }

  const fenKey = pos.initialFen.split(' ').slice(0, 4).join(' ');
  if (fens.has(fenKey)) errors.push(`${pos.id}: duplicate FEN`);
  fens.add(fenKey);

  const legality = validateFenLegality(pos.initialFen);
  if (!legality.ok) {
    bothKingsSafe = false;
    for (const e of legality.errors) errors.push(`${pos.id}: ${e}`);
  }
  if (legality.whiteKingInCheck || legality.blackKingInCheck) bothKingsSafe = false;

  const material = validateThemeMaterial(pos.themeId, pos.initialFen);
  if (!material.ok) {
    materialOk = false;
    for (const e of material.errors) errors.push(`${pos.id}: ${e}`);
  }

  if (pos.playerColor === 'white') whitePlayer += 1;
  else blackPlayer += 1;
  if (pos.objective === 'WIN') winCount += 1;
  else drawCount += 1;

  const isMateTheme = MATE_THEMES.has(pos.themeId);
  if (isMateTheme && pos.completion.type !== 'CHECKMATE') {
    errors.push(`${pos.id}: mate theme must use CHECKMATE`);
  }
  if (!isMateTheme && pos.completion.type !== 'OFFICIAL_GAME_RESULT') {
    errors.push(`${pos.id}: non-mate theme must use OFFICIAL_GAME_RESULT`);
  }

  if (pos.certification.result !== pos.objective) {
    certificationOk = false;
    errors.push(`${pos.id}: certification.result must match objective`);
  }

  const pieceCount = countPieces(pos.initialFen);
  if (pieceCount <= 7) {
    if (pos.certification.type !== 'SYZYGY') {
      certificationOk = false;
      errors.push(`${pos.id}: <=7 pieces requires SYZYGY`);
    } else {
      syzygyCount += 1;
    }
  } else if (pos.certification.type !== 'ENGINE' || pos.certification.depth !== 30) {
    certificationOk = false;
    errors.push(`${pos.id}: >7 pieces requires ENGINE depth 30`);
  }

  if (!pos.explanation?.fr || !pos.explanation?.en) {
    errors.push(`${pos.id}: missing bilingual explanation`);
  }
}

gates.activeCount10 = active.length === 10;
if (!gates.activeCount10) errors.push(`active count ${active.length} !== 10`);

gates.themes10 = THEME_IDS.length === 10 && !THEME_IDS.includes('three-pawns');
if (!gates.themes10) errors.push('expected exactly 10 themes without three-pawns');

gates.onePerTheme = THEME_IDS.every((id) => themeCounts[id] === 1);
if (!gates.onePerTheme) {
  for (const id of THEME_IDS) {
    if (themeCounts[id] !== 1) {
      errors.push(`theme ${id}: expected 1 active position, found ${themeCounts[id] ?? 0}`);
    }
  }
}

gates.noLegacyIds = ![...ids].some((id) => LEGACY_THEORETICAL_IDS.includes(id));
gates.noThreePawns = !Object.keys(themeCounts).includes('three-pawns') &&
  !active.some((p) => p.themeId === 'three-pawns');
gates.bothKingsNotInCheck = bothKingsSafe && errors.every((e) => !e.includes('in check'));
gates.materialOk = materialOk;
gates.certificationOk = certificationOk;

const lucena = active.find((p) => p.themeId === 'lucena');
const philidor = active.find((p) => p.themeId === 'philidor');
gates.lucenaStructure =
  !!lucena && validateThemeMaterial('lucena', lucena.initialFen).ok && lucena.objective === 'WIN';
gates.philidorStructure =
  !!philidor &&
  validateThemeMaterial('philidor', philidor.initialFen).ok &&
  philidor.objective === 'DRAW' &&
  philidor.playerColor === 'black';

if (!gates.lucenaStructure) errors.push('Lucena structure/objective gate failed');
if (!gates.philidorStructure) errors.push('Philidor structure/objective gate failed');

const canonById = Object.fromEntries((canonical.positions ?? []).map((p) => [p.id, p]));

const positionReports = active.map((p) => {
  const legality = validateFenLegality(p.initialFen);
  const canon = canonById[p.id];
  return {
    id: p.id,
    themeId: p.themeId,
    fen: p.initialFen,
    pieces: readablePieces(p.initialFen),
    sideToMove: p.initialFen.split(' ')[1] === 'b' ? 'black' : 'white',
    trainedColor: p.playerColor,
    objective: p.objective,
    pieceCount: countPieces(p.initialFen),
    certification: p.certification,
    bothKingsNotInCheck: !legality.whiteKingInCheck && !legality.blackKingInCheck,
    theoreticalStructureOk: validateThemeMaterial(p.themeId, p.initialFen).ok,
    sources: canon?.sourceReferences ?? [],
    choiceRationale: canon?.choiceRationale ?? '',
    alerts: legality.errors,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  datasetVersion: THEORETICAL_ENDGAME_CONFIG.datasetVersion,
  contentVersion: THEORETICAL_ENDGAME_CONFIG.contentVersion,
  summary: {
    positionsBefore: 44,
    positionsAfter: active.length,
    legacyIdsPresent: [...ids].filter((id) => LEGACY_THEORETICAL_IDS.includes(id)).length,
    themesBefore: [
      ...THEME_IDS,
      'three-pawns',
    ],
    themesAfter: [...THEME_IDS],
    winCount,
    drawCount,
    whitePlayerPositions: whitePlayer,
    blackPlayerPositions: blackPlayer,
    syzygyCertified: syzygyCount,
    errorCount: errors.length,
    warningCount: warnings.length,
    valid: errors.length === 0,
    gates,
  },
  errors,
  warnings,
  positions: positionReports,
};

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
// Keep legacy path updated for older tooling that still points here.
writeFileSync(LEGACY_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Validated ${active.length} theoretical endgame positions`);
console.log(`  white player: ${whitePlayer}, black player: ${blackPlayer}`);
console.log(`  WIN: ${winCount}, DRAW: ${drawCount}`);
console.log(`  errors: ${errors.length}, warnings: ${warnings.length}`);
console.log(`  report: ${REPORT_PATH}`);

if (errors.length > 0) {
  for (const err of errors) console.error(`✗ ${err}`);
  process.exitCode = 1;
} else {
  console.log('✓ pool validation passed');
}
