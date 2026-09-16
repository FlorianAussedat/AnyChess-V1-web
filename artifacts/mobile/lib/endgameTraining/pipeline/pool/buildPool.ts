/**
 * Build runtime pool from candidates + curation + manual positions.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EndgameTrainingPosition } from '../../domain/types.ts';
import { computeContentVersion } from './contentVersion.ts';
import { loadCandidates, loadCuration, loadManualPositions, saveManifest, savePoolReport } from './io.ts';
import { manualPositionId } from './stableId.ts';
import { PATHS } from './paths.ts';
import type { PoolBuildReport, PoolCandidate, PoolManifest } from './types.ts';
import { PIPELINE_VERSION, POOL_SCHEMA_VERSION } from './types.ts';
import { ENDGAME_POOL_DATASET_VERSION } from '../../data/poolMetadata.ts';

export type BuildOptions = {
  requireProduction?: boolean;
  seed?: string;
};

function candidateToRuntime(
  c: PoolCandidate,
  contentVersion: string,
): EndgameTrainingPosition {
  const validationKind =
    c.certification?.type === 'syzygy' ? 'syzygy' : 'stockfish';
  return {
    id: c.positionId,
    fen: c.initialFen,
    defender: c.playerColor,
    objective: 'DRAW',
    source: {
      provider: c.source.provider,
      sourceId: c.source.sourceId,
      gameUrl: c.source.gameUrl,
      license: c.source.license,
      importedAt: c.importedAt.slice(0, 10),
      sourcePly: c.source.sourcePly,
    },
    family: c.family,
    materialSignature: c.materialSignature,
    tags: c.tags,
    quality: {
      initialEvaluation: c.originCriticalMove?.evaluationBefore ?? 0,
      validationKind,
      defensiveMoveCount: c.quality.safeMoveCount,
      pieceCount: c.quality.pieceCount,
      safeMoveCount: c.quality.safeMoveCount,
      pressureCp: c.quality.pressureCp,
      expectedDuration: c.quality.expectedDuration,
      liquidationRisk: c.quality.liquidationRisk,
      similarityGroup: c.quality.similarityGroup,
    },
    originCriticalMove: c.originCriticalMove,
    certification: c.certification
      ? {
          type: c.certification.type,
          result: 'DRAW',
          details: c.certification.details,
        }
      : undefined,
    datasetContentVersion: contentVersion,
  };
}

function formatPoolModule(positions: readonly EndgameTrainingPosition[]): string {
  const body = positions.map((p) => `  ${JSON.stringify(p)},`).join('\n');
  return `/**
 * AUTO-GENERATED endgame training pool (product runtime).
 *
 * Replaced entirely by the offline Lichess import pipeline.
 * Dataset version: ${ENDGAME_POOL_DATASET_VERSION}
 * Do not edit manually — run pnpm endgame-pool:build
 */
import type { EndgameTrainingPosition } from '../domain/types.ts';

export const ENDGAME_TRAINING_POOL: readonly EndgameTrainingPosition[] = [
${body}
];
`;
}

export function buildEndgamePool(options: BuildOptions = {}): {
  positions: EndgameTrainingPosition[];
  manifest: PoolManifest;
  report: PoolBuildReport;
} {
  const candidatesFile = loadCandidates(PATHS.candidates);
  const curation = loadCuration(PATHS.curation);
  const manual = loadManualPositions(PATHS.manual);

  const acceptedIds = new Set(
    Object.values(curation.decisions)
      .filter((d) => d.status === 'accepted')
      .map((d) => d.positionId),
  );
  const disabledIds = Object.values(curation.decisions)
    .filter((d) => d.status === 'disabled')
    .map((d) => d.positionId);

  const candidateMap = new Map(
    candidatesFile.candidates.map((c) => [c.positionId, c]),
  );

  const activeCandidates: PoolCandidate[] = [];
  for (const id of acceptedIds) {
    const c = candidateMap.get(id);
    if (c && c.pipelineStatus === 'certified') {
      activeCandidates.push(c);
    }
  }

  // Manual positions would be merged here when present (same certification gates).

  activeCandidates.sort((a, b) => a.positionId.localeCompare(b.positionId));

  if (activeCandidates.length === 0 && options.requireProduction) {
    throw new Error('Build refused: zero active positions for production pool.');
  }

  const positionsDraft = activeCandidates.map((c) => candidateToRuntime(c, ''));
  const contentVersion = computeContentVersion(positionsDraft);
  const positionsWithVersion = positionsDraft.map((p) => ({
    ...p,
    datasetContentVersion: contentVersion,
  }));

  const familyDistribution: Record<string, number> = {};
  const tagDistribution: Record<string, number> = {};
  let syzygyCount = 0;
  let stockfishCount = 0;

  for (const p of positionsWithVersion) {
    bump(familyDistribution, String(p.family));
    for (const t of p.tags) bump(tagDistribution, t);
    if (p.certification?.type === 'syzygy') syzygyCount += 1;
    else if (p.certification?.type === 'stockfish-stable-draw') stockfishCount += 1;
  }

  const rejectedCount = candidatesFile.candidates.filter(
    (c) => c.pipelineStatus === 'rejected',
  ).length;

  const manifest: PoolManifest = {
    schemaVersion: POOL_SCHEMA_VERSION,
    contentVersion,
    generatedAt: new Date().toISOString(),
    seed: options.seed ?? candidatesFile.seed,
    pipelineVersion: PIPELINE_VERSION,
    lichessSource: candidatesFile.sourceSha256
      ? {
          path: candidatesFile.sourceFile ?? '',
          sha256: candidatesFile.sourceSha256,
          license: 'CC0-1.0',
        }
      : undefined,
    activeCount: positionsWithVersion.length,
    activeIds: positionsWithVersion.map((p) => p.id),
    disabledIds,
    rejectedCount,
    familyDistribution,
    tagDistribution,
    syzygyCount,
    stockfishCount,
  };

  const report: PoolBuildReport = {
    generatedAt: manifest.generatedAt,
    sourceFile: candidatesFile.sourceFile,
    sourceSha256: candidatesFile.sourceSha256,
    rowsScanned: 0,
    prefiltered: 0,
    candidatesTotal: candidatesFile.candidates.length,
    certified: candidatesFile.candidates.filter((c) => c.pipelineStatus === 'certified').length,
    accepted: positionsWithVersion.length,
    rejected: rejectedCount,
    disabled: disabledIds.length,
    active: positionsWithVersion.length,
    rejectionReasons: {},
    familyDistribution,
    forbiddenLegacyIds: [],
    contentVersion,
    parameters: { seed: manifest.seed, pipelineVersion: PIPELINE_VERSION },
  };

  if (positionsWithVersion.length > 0) {
    mkdirSync(dirname(PATHS.poolGenerated), { recursive: true });
    writeFileSync(PATHS.poolGenerated, formatPoolModule(positionsWithVersion), 'utf8');
  }

  saveManifest(PATHS.manifest, manifest);
  savePoolReport(PATHS.poolReport, report);

  return { positions: positionsWithVersion, manifest, report };
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function writePoolMetadata(generation: string): void {
  const content = `/**
 * Runtime endgame-training pool metadata (product dataset).
 * Increment when replacing pool.generated.ts with a new collection.
 */
export const ENDGAME_POOL_DATASET_VERSION = '${ENDGAME_POOL_DATASET_VERSION}';

/** Human-readable generation label for reports and debugging. */
export const ENDGAME_POOL_GENERATION = '${generation}';
`;
  writeFileSync(PATHS.metadata, content, 'utf8');
}
