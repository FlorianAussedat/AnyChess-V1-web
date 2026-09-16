import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CERTIFIED_DEFEND_DRAW_POSITIONS } from '../positions.ts';
import type { DefendDrawPosition } from '../positions.ts';
import type { AnyChessDifficultyId } from '../../difficulty/anyChessDifficulty.ts';
import type { EndgameFamily } from '../taxonomy.ts';
import { certifyDefendDrawPosition } from '../certifyPosition.ts';
import { analyzeDrawingWalk } from '../analyzeDifficulty.ts';
import {
  DEFAULT_POOL_TARGETS,
  type BuildRejection,
  type PoolTargets,
  type RawCandidate,
} from './candidateTypes.ts';
import { generateAllCandidates } from './generators.ts';
import { importPgnCandidates } from './pgnImport.ts';
import { normalizeFenKey } from './fenUtils.ts';
import {
  inferEndgameConcepts,
  inferEndgameFamily,
} from './inferTaxonomy.ts';
import {
  suggestDefendDrawDifficulty,
} from './suggestDifficulty.ts';
import { writeGeneratedPool, writePositionsWrapper } from './writePool.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

export type BuildPoolOptions = {
  seed: number;
  targets?: Partial<PoolTargets>;
  pauseMs?: number;
  maxCandidates?: number;
  allowStockfishFallback?: boolean;
  dryRun?: boolean;
};

export type BuildPoolReport = {
  seed: number;
  targets: PoolTargets;
  totals: {
    candidates: number;
    certified: number;
    selected: number;
    rejected: number;
  };
  byDifficulty: Record<AnyChessDifficultyId, number>;
  byFamily: Record<EndgameFamily, number>;
  bySource: { syzygy: number; stockfish: number; theoretical: number; masterGame: number };
  keptFromExisting: string[];
  reclassified: Array<{ id: string; from: string; to: string }>;
  removed: Array<{ id: string; reason: string }>;
  added: string[];
  rejectionsByReason: Record<string, number>;
  familyWarnings: string[];
  examples: Record<AnyChessDifficultyId, Array<{
    id: string;
    family: EndgameFamily;
    concepts: string[];
    pieces: number;
    drawLeg: string;
    criticalMoves: number;
    uniqueMoveMoments: number;
  }>>;
};

type CertifiedCandidate = DefendDrawPosition & {
  suggestedDifficulty: AnyChessDifficultyId;
  fenKey: string;
};

const DROP_EXISTING_IDS = new Set(['DD-034', 'DD-035']);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function processCandidate(
  raw: RawCandidate,
  id: string,
  options: BuildPoolOptions,
): Promise<{ ok: true; row: CertifiedCandidate } | { ok: false; rejection: BuildRejection }> {
  const fenKey = normalizeFenKey(raw.fen);

  const cert = await certifyDefendDrawPosition(
    {
      id,
      fen: raw.fen,
      defenderColor: raw.defenderColor,
      legalMoves: 1,
      drawingMoves: 1,
    },
    {
      allowStockfishFallback: options.allowStockfishFallback ?? false,
      tablebaseTimeoutMs: 10_000,
    },
  );

  if (!cert.ok) {
    return {
      ok: false,
      rejection: {
        fen: raw.fen,
        reason: 'certification-failed',
        detail: cert.reason,
      },
    };
  }

  const metrics = await analyzeDrawingWalk(raw.fen, {
    plyDepth: 3,
    pauseMs: options.pauseMs ?? 40,
  });

  const family = inferEndgameFamily(raw.fen);
  const conceptList = inferEndgameConcepts(raw.fen, family, metrics);
  const concepts = (conceptList.length > 0
    ? conceptList
    : ['accurate-defense']) as unknown as DefendDrawPosition['concepts'];
  const suggested = suggestDefendDrawDifficulty({
    fen: raw.fen,
    family,
    metrics,
  });

  const row: CertifiedCandidate = {
    id,
    fen: raw.fen,
    difficulty: suggested,
    family,
    concepts,
    theme: raw.theme,
    label: raw.label,
    defenderColor: raw.defenderColor,
    playerColor: raw.defenderColor,
    verifiedDraw: true,
    verification: cert.verification,
    legalMoves: cert.legalMoves,
    drawingMoves: cert.drawingMoves,
    difficultyMetrics: metrics
      ? {
          legalMoves: metrics.legalMoves,
          drawingMoves: metrics.drawingMoves,
          losingMoves: metrics.losingMoves,
          drawingRatio: metrics.drawingRatio,
          criticalMoves: metrics.criticalMoves,
          uniqueMoveMoments: metrics.uniqueMoveMoments,
        }
      : undefined,
    source: raw.source,
    suggestedDifficulty: suggested,
    fenKey,
  };

  return { ok: true, row };
}

import { reselectFromCertifiedRows, type ReselectRow } from './reselect.ts';

function familyDistributionWarning(
  positions: DefendDrawPosition[],
): string[] {
  const warnings: string[] = [];
  for (const band of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
    const rows = positions.filter((p) => p.difficulty === band);
    if (rows.length === 0) continue;
    const fam: Record<string, number> = {};
    for (const r of rows) fam[r.family] = (fam[r.family] ?? 0) + 1;
    const top = Object.entries(fam).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] / rows.length > 0.65) {
      warnings.push(
        `${band}: family "${top[0]}" dominates (${top[1]}/${rows.length})`,
      );
    }
  }
  return warnings;
}

export async function buildDefendDrawPool(
  options: BuildPoolOptions,
): Promise<BuildPoolReport> {
  const targets: PoolTargets = { ...DEFAULT_POOL_TARGETS, ...options.targets };
  const pgnDir = join(mobileRoot, 'data/defend-draw-pgn');
  const pgnCandidates = importPgnCandidates(pgnDir);
  const generated = generateAllCandidates({ seed: options.seed }, pgnCandidates);

  const existingByFen = new Map<string, DefendDrawPosition>();
  const keptFromExisting: string[] = [];
  const removed: Array<{ id: string; reason: string }> = [];
  const reclassified: Array<{ id: string; from: string; to: string }> = [];

  for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
    if (DROP_EXISTING_IDS.has(p.id)) {
      removed.push({ id: p.id, reason: 'duplicate FEN (canonical row kept)' });
      continue;
    }
    const key = normalizeFenKey(p.fen);
    if (existingByFen.has(key)) {
      removed.push({ id: p.id, reason: 'duplicate FEN' });
      continue;
    }
    existingByFen.set(key, p);
    keptFromExisting.push(p.id);
  }

  const seenFen = new Set<string>([...existingByFen.keys()]);
  const candidates: RawCandidate[] = [];
  for (const c of generated) {
    const key = normalizeFenKey(c.fen);
    if (seenFen.has(key)) continue;
    seenFen.add(key);
    candidates.push(c);
  }

  const max = options.maxCandidates ?? candidates.length;
  const toProcess = candidates.slice(0, max);
  console.log(`[builder] ${toProcess.length} new candidates (+ ${existingByFen.size} existing rows)`);

  const rejections: BuildRejection[] = [];
  const certified: CertifiedCandidate[] = [];
  let nextId = 1;

  // Re-certify and enrich existing positions first
  for (const existing of existingByFen.values()) {
    const result = await processCandidate(
      {
        fen: existing.fen,
        defenderColor: existing.defenderColor,
        theme: existing.theme,
        label: existing.label,
        source: existing.source ?? { type: 'theoretical' },
      },
      existing.id,
      options,
    );
    if (!result.ok) {
      removed.push({ id: existing.id, reason: result.rejection.detail });
      continue;
    }
    if (result.row.suggestedDifficulty !== existing.difficulty) {
      reclassified.push({
        id: existing.id,
        from: existing.difficulty,
        to: result.row.suggestedDifficulty,
      });
    }
    certified.push({ ...result.row, id: existing.id });
    if (options.pauseMs) await sleep(options.pauseMs);
  }

  for (const raw of toProcess) {
    while (nextId <= 999) {
      const id = `DD-${String(nextId).padStart(3, '0')}`;
      nextId += 1;
      if (certified.some((c) => c.id === id)) continue;
      const result = await processCandidate(raw, id, options);
      if (!result.ok) {
        rejections.push(result.rejection);
        break;
      }
      certified.push(result.row);
      if (certified.length % 25 === 0) {
        console.log(`  … certified ${certified.length} (processed ${rejections.length} rejects)`);
      }
      break;
    }
    if (options.pauseMs) await sleep(options.pauseMs);
  }

  const selected = reselectFromCertifiedRows(
    certified as ReselectRow[],
    targets,
  );
  const added = selected
    .filter((p) => !keptFromExisting.includes(p.id))
    .map((p) => p.id);

  const byDifficulty: Record<AnyChessDifficultyId, number> = {
    debutant: 0,
    confirme: 0,
    expert: 0,
    grandMaitre: 0,
  };
  const byFamily: Record<EndgameFamily, number> = {
    pawn: 0,
    rook: 0,
    queen: 0,
    'minor-piece': 0,
    fortress: 0,
    imbalanced: 0,
  };
  const bySource = { syzygy: 0, stockfish: 0, theoretical: 0, masterGame: 0 };

  for (const p of selected) {
    byDifficulty[p.difficulty] += 1;
    byFamily[p.family] += 1;
    if (p.verification.method === 'syzygy') bySource.syzygy += 1;
    else bySource.stockfish += 1;
    if (p.source?.type === 'master-game') bySource.masterGame += 1;
    else bySource.theoretical += 1;
  }

  const rejectionsByReason: Record<string, number> = {};
  for (const r of rejections) {
    rejectionsByReason[r.reason] = (rejectionsByReason[r.reason] ?? 0) + 1;
  }

  const examples = {} as BuildPoolReport['examples'];
  for (const band of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
    examples[band] = selected
      .filter((p) => p.difficulty === band)
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        family: p.family,
        concepts: [...p.concepts],
        pieces: p.fen.split(' ')[0]!.replace(/\d/g, '').length,
        drawLeg: `${p.drawingMoves}/${p.legalMoves}`,
        criticalMoves: p.difficultyMetrics?.criticalMoves ?? 0,
        uniqueMoveMoments: p.difficultyMetrics?.uniqueMoveMoments ?? 0,
      }));
  }

  const report: BuildPoolReport = {
    seed: options.seed,
    targets,
    totals: {
      candidates: toProcess.length + existingByFen.size,
      certified: certified.length,
      selected: selected.length,
      rejected: rejections.length,
    },
    byDifficulty,
    byFamily,
    bySource,
    keptFromExisting,
    reclassified,
    removed,
    added,
    rejectionsByReason,
    familyWarnings: familyDistributionWarning(selected),
    examples,
  };

  if (!options.dryRun) {
    writeGeneratedPool(selected, report);
    writePositionsWrapper(selected.length);
  }

  return report;
}
