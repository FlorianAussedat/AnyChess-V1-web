#!/usr/bin/env node
/**
 * Offline audit + quality reclassification of the existing certified pool.
 *
 * Does NOT re-run Syzygy. Does NOT import Lichess.
 * Filters liquidation / soft / near-duplicates, reassigns difficulty without
 * artificial quota filling, writes a reduced pool + before/after report.
 *
 * Usage: node --experimental-strip-types scripts/reclassify-endgame-quality.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_DEFEND_DRAW_POOL } from '../lib/defendDraw/data/pool.generated.ts';
import {
  evaluateEndgameQuality,
  inferTrainingStyle,
  shouldRejectForQuality,
} from '../lib/defendDraw/qualityFilter.ts';
import { materialSignature, isBareHeavySymmetry } from '../lib/defendDraw/materialSignature.ts';
import { suggestDefendDrawDifficulty } from '../lib/defendDraw/builder/suggestDifficulty.ts';
import { reselectFromCertifiedRows } from '../lib/defendDraw/builder/reselect.ts';
import { writeGeneratedPool } from '../lib/defendDraw/builder/writePool.ts';
import { DEFAULT_POOL_TARGETS } from '../lib/defendDraw/builder/candidateTypes.ts';
import { normalizeFenKey } from '../lib/defendDraw/builder/fenUtils.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..');

function bandCounts(rows) {
  const out = { debutant: 0, confirme: 0, expert: 0, grandMaitre: 0 };
  for (const r of rows) out[r.difficulty] = (out[r.difficulty] ?? 0) + 1;
  return out;
}

function familyCounts(rows) {
  const out = {};
  for (const r of rows) out[r.family] = (out[r.family] ?? 0) + 1;
  return out;
}

function styleCounts(rows) {
  const out = { technical: 0, practical: 0, critical: 0 };
  for (const r of rows) {
    const s = r.trainingStyle ?? 'practical';
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

function gmJustification(row) {
  const m = row.difficultyMetrics;
  const parts = [];
  if ((m?.uniqueMoveMoments ?? 0) >= 2) parts.push(`${m.uniqueMoveMoments} unique-move moments`);
  if ((m?.criticalMoves ?? 0) >= 1) parts.push(`${m.criticalMoves} critical moves`);
  if ((m?.drawingRatio ?? 1) <= 0.4) parts.push(`drawing ratio ${(m.drawingRatio * 100).toFixed(0)}%`);
  if ((m?.drawingMoves ?? 99) <= 3) parts.push(`only ${m.drawingMoves} drawing moves`);
  if (row.qualityMetrics && !row.qualityMetrics.immediateLiquidation) {
    parts.push('no immediate liquidation');
  }
  if (parts.length === 0) return 'Insufficient GM signals — should not be GM';
  return parts.join('; ');
}

const before = GENERATED_DEFEND_DRAW_POOL;
const auditRows = [];
const rejected = [];
const keptCandidates = [];

for (const pos of before) {
  const style = inferTrainingStyle({
    family: pos.family,
    theme: pos.theme,
    concepts: pos.concepts,
    metrics: pos.difficultyMetrics ?? null,
    sourceType: pos.source?.type,
  });
  const mat = materialSignature(pos.fen);
  const quality = evaluateEndgameQuality({
    fen: pos.fen,
    family: pos.family,
    playerColor: pos.playerColor,
    theme: pos.theme,
    metrics: pos.difficultyMetrics ?? null,
    trainingStyle: style,
    qualityOverride: pos.qualityOverride,
  });

  const suggested = suggestDefendDrawDifficulty({
    fen: pos.fen,
    family: pos.family,
    metrics: pos.difficultyMetrics
      ? {
          legalMoves: pos.difficultyMetrics.legalMoves,
          drawingMoves: pos.difficultyMetrics.drawingMoves,
          losingMoves: pos.difficultyMetrics.losingMoves,
          drawingRatio: pos.difficultyMetrics.drawingRatio,
          criticalMoves: pos.difficultyMetrics.criticalMoves,
          uniqueMoveMoments: pos.difficultyMetrics.uniqueMoveMoments,
        }
      : null,
    trainingStyle: style,
    qualityScore: quality.qualityScore,
  });

  const row = {
    id: pos.id,
    fen: pos.fen,
    oldDifficulty: pos.difficulty,
    suggestedDifficulty: suggested,
    family: pos.family,
    concepts: pos.concepts,
    theme: pos.theme,
    materialSignature: mat,
    objective: pos.objective ?? 'DRAW',
    legalMoves: pos.legalMoves,
    drawingMoves: pos.drawingMoves,
    drawingRatio: pos.difficultyMetrics?.drawingRatio ?? null,
    bareHeavySymmetry: isBareHeavySymmetry(pos.fen),
    trainingStyle: style,
    quality,
    classificationNote:
      pos.difficulty !== suggested
        ? `was ${pos.difficulty}, metrics suggest ${suggested}`
        : `kept suggestion ${suggested}`,
  };
  auditRows.push(row);

  if (shouldRejectForQuality(quality, pos.qualityOverride)) {
    rejected.push({
      id: pos.id,
      fen: pos.fen,
      oldDifficulty: pos.difficulty,
      family: pos.family,
      materialSignature: mat,
      reasons: quality.rejectionReasons,
      qualityScore: quality.qualityScore,
      note:
        pos.id === 'DD-113'
          ? 'Q vs Q bare — immediate liquidation to K vs K; no pedagogical interest'
          : undefined,
    });
    continue;
  }

  keptCandidates.push({
    ...pos,
    objective: pos.objective ?? 'DRAW',
    trainingStyle: style,
    materialSignature: mat,
    qualityMetrics: quality,
    suggestedDifficulty: suggested,
    fenKey: normalizeFenKey(pos.fen),
    difficultyJustification:
      suggested === 'grandMaitre' ? gmJustification({ ...pos, qualityMetrics: quality }) : undefined,
  });
}

// Soft targets — maxima, not obligations. Prefer fewer good positions.
// Raised to absorb quality-passing historical positions; variety rules still apply.
const softTargets = {
  debutant: 30,
  confirme: 40,
  expert: 25,
  grandMaitre: 12,
};

const selected = reselectFromCertifiedRows(keptCandidates, softTargets);

// Ensure DD-113 is never in the output
const finalPool = selected.filter((p) => p.id !== 'DD-113');
if (selected.some((p) => p.id === 'DD-113')) {
  rejected.push({
    id: 'DD-113',
    fen: '6Q1/2q5/8/8/K7/8/3k4/8 b - - 0 1',
    oldDifficulty: 'expert',
    family: 'queen',
    reasons: ['forced-reject-dd113-regression'],
    qualityScore: 0,
    note: 'Hard non-regression reject',
  });
}

const levelChanges = auditRows
  .filter((r) => finalPool.some((p) => p.id === r.id) && r.oldDifficulty !== r.suggestedDifficulty)
  .map((r) => ({
    id: r.id,
    from: r.oldDifficulty,
    to: r.suggestedDifficulty,
    note: r.classificationNote,
  }));

const gmKept = finalPool.filter((p) => p.difficulty === 'grandMaitre').map((p) => ({
  id: p.id,
  fen: p.fen,
  family: p.family,
  justification: p.difficultyJustification ?? gmJustification(p),
  metrics: p.difficultyMetrics,
  qualityScore: p.qualityMetrics?.qualityScore,
}));

const report = {
  generatedAt: new Date().toISOString(),
  before: {
    total: before.length,
    byDifficulty: bandCounts(before),
    byFamily: familyCounts(before),
  },
  after: {
    total: finalPool.length,
    byDifficulty: bandCounts(finalPool),
    byFamily: familyCounts(finalPool),
    byStyle: styleCounts(finalPool),
  },
  rejected: {
    count: rejected.length,
    byReason: rejected.reduce((acc, r) => {
      for (const reason of r.reasons) {
        acc[reason] = (acc[reason] ?? 0) + 1;
      }
      return acc;
    }, {}),
    positions: rejected,
  },
  levelChanges,
  gmJustifications: gmKept,
  dd113: auditRows.find((r) => r.id === 'DD-113') ?? null,
  softTargets,
  policy: {
    noArtificialQuotaFill: true,
    qualityBeforeQuantity: true,
    lichessImport: 'deferred',
  },
  auditSample: auditRows.slice(0, 20),
  auditAll: auditRows,
};

writeGeneratedPool(finalPool, report);

mkdirSync(join(mobileRoot, 'data'), { recursive: true });
writeFileSync(
  join(mobileRoot, 'data/endgame-quality-report.json'),
  JSON.stringify(report, null, 2),
  'utf8',
);

console.log(
  JSON.stringify(
    {
      before: report.before.total,
      after: report.after.total,
      rejected: report.rejected.count,
      byDifficulty: report.after.byDifficulty,
      byFamily: report.after.byFamily,
      byStyle: report.after.byStyle,
      dd113Rejected: rejected.some((r) => r.id === 'DD-113'),
      gmCount: gmKept.length,
    },
    null,
    2,
  ),
);
