/**
 * Validates THEORETICAL_ENDGAME_POOL and writes a quality report.
 *
 * Usage:
 *   node --experimental-strip-types scripts/validate-theoretical-endgame-pool.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { THEORETICAL_ENDGAME_POOL } from '../lib/theoreticalEndgame/data/pool.generated.ts';
import { THEME_IDS } from '../lib/theoreticalEndgame/domain/themes.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, '../data/theoretical-endgame-quality-report.json');

const MATE_THEMES = new Set(['queen-mate', 'rook-mate', 'two-bishops-mate']);

const TARGET_RANGES = {
  'queen-mate': [8, 12],
  'rook-mate': [10, 15],
  'two-bishops-mate': [15, 20],
  'pawn-square': [3, 6],
  opposition: [4, 8],
  'kp-vs-k': [5, 12],
  'pawn-race': [3, 6],
  'pawn-breakthrough': [4, 8],
  'three-pawns': [8, 15],
  lucena: [8, 12],
  philidor: [5, 10],
};

function countPieces(fen) {
  return fen.split(' ')[0].replace(/[^KQRBNPqkrbnp]/g, '').length;
}

function sideToMoveColor(fen) {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

const errors = [];
const warnings = [];
const themeCounts = Object.fromEntries(THEME_IDS.map((id) => [id, 0]));
const ids = new Set();
const fens = new Set();
let whitePlayer = 0;
let blackPlayer = 0;

for (const pos of THEORETICAL_ENDGAME_POOL) {
  themeCounts[pos.themeId] = (themeCounts[pos.themeId] ?? 0) + 1;

  if (ids.has(pos.id)) errors.push(`duplicate id: ${pos.id}`);
  ids.add(pos.id);

  if (!/^TE-\d{3}$/.test(pos.id)) {
    errors.push(`${pos.id}: id must match TE-NNN`);
  }

  const fenKey = pos.initialFen.split(' ').slice(0, 4).join(' ');
  if (fens.has(fenKey)) errors.push(`${pos.id}: duplicate FEN`);
  fens.add(fenKey);

  let board;
  try {
    board = new Chess(pos.initialFen);
  } catch (e) {
    errors.push(`${pos.id}: illegal FEN — ${e.message}`);
    continue;
  }

  if (board.isGameOver()) {
    errors.push(`${pos.id}: position is already terminal`);
  }

  const stm = sideToMoveColor(pos.initialFen);
  if (pos.playerColor !== stm) {
    errors.push(`${pos.id}: playerColor ${pos.playerColor} does not match side to move (${stm})`);
  }

  if (pos.playerColor === 'white') whitePlayer += 1;
  else blackPlayer += 1;

  const isMateTheme = MATE_THEMES.has(pos.themeId);
  if (isMateTheme && pos.completion.type !== 'CHECKMATE') {
    errors.push(`${pos.id}: mate theme must use CHECKMATE completion`);
  }
  if (!isMateTheme && pos.completion.type !== 'OFFICIAL_GAME_RESULT') {
    errors.push(`${pos.id}: non-mate theme must use OFFICIAL_GAME_RESULT completion`);
  }

  if (pos.certification.result !== pos.objective) {
    errors.push(`${pos.id}: certification.result must match objective`);
  }

  const pieceCount = countPieces(pos.initialFen);
  if (pieceCount <= 7) {
    if (pos.certification.type !== 'SYZYGY') {
      errors.push(`${pos.id}: <=7 pieces requires SYZYGY certification (has ${pieceCount})`);
    }
  } else if (pos.certification.type !== 'ENGINE' || pos.certification.depth !== 30) {
    errors.push(`${pos.id}: >7 pieces requires ENGINE depth 30 (has ${pieceCount})`);
  }

  const [min, max] = TARGET_RANGES[pos.themeId] ?? [0, 999];
  if (pos.targetUserMoves < min || pos.targetUserMoves > max) {
    warnings.push(
      `${pos.id}: targetUserMoves ${pos.targetUserMoves} outside theme range ${min}-${max}`,
    );
  }

  if (!pos.source || pos.source.name !== 'anychess-theoretical') {
    errors.push(`${pos.id}: missing anychess-theoretical source`);
  }

  if (!Array.isArray(pos.tags) || pos.tags.length === 0) {
    errors.push(`${pos.id}: tags must be non-empty`);
  }
}

const count = THEORETICAL_ENDGAME_POOL.length;
if (count < 40 || count > 50) {
  errors.push(`pool count ${count} outside allowed range 40-50`);
}

for (const themeId of THEME_IDS) {
  if (themeCounts[themeId] !== 4) {
    errors.push(`theme ${themeId}: expected 4 positions, found ${themeCounts[themeId] ?? 0}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  datasetVersion: '1.0.0',
  poolPath: 'lib/theoreticalEndgame/data/pool.generated.ts',
  summary: {
    totalPositions: count,
    uniqueIds: ids.size,
    uniqueFens: fens.size,
    whitePlayerPositions: whitePlayer,
    blackPlayerPositions: blackPlayer,
    themeCounts,
    errorCount: errors.length,
    warningCount: warnings.length,
    valid: errors.length === 0,
  },
  errors,
  warnings,
  positions: THEORETICAL_ENDGAME_POOL.map((p) => ({
    id: p.id,
    themeId: p.themeId,
    objective: p.objective,
    playerColor: p.playerColor,
    pieceCount: countPieces(p.initialFen),
    certification: p.certification.type,
    targetUserMoves: p.targetUserMoves,
  })),
};

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Validated ${count} theoretical endgame positions`);
console.log(`  white player: ${whitePlayer}, black player: ${blackPlayer}`);
console.log(`  errors: ${errors.length}, warnings: ${warnings.length}`);
console.log(`  report: ${REPORT_PATH}`);

if (errors.length > 0) {
  for (const err of errors) console.error(`✗ ${err}`);
  process.exitCode = 1;
} else {
  console.log('✓ pool validation passed');
  for (const warn of warnings) console.warn(`⚠ ${warn}`);
}
