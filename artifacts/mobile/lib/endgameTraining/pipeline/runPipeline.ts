/**
 * Offline Lichess → EndgameTrainingPosition orchestrator.
 * Does NOT require the massive Lichess file in the repo — pass a CSV path
 * (or use the sample fixture / mock analyzer in tests).
 */
import type { EndgameTrainingPosition } from '../domain/types.ts';
import {
  iterLichessCsv,
  toPipelineFields,
  type LichessPuzzleRow,
} from './lichessCsv.ts';
import {
  FenDedupeSet,
  isClearlyLostAfterError,
  isNearDrawEval,
  meetsMinDefensiveMoves,
} from './qualityFilters.ts';
import { validateStartFen } from './validateCandidate.ts';
import type {
  PipelineAnalyzer,
  PipelineReport,
  PipelineResult,
  RejectionReason,
} from './types.ts';

export type RunPipelineOptions = {
  csvPath?: string;
  /** Pre-loaded rows (tests / fixtures) — skips csvPath when set. */
  rows?: LichessPuzzleRow[];
  analyzer?: PipelineAnalyzer;
  limit?: number;
  /** Only keep these PuzzleIds (comma-separated list also accepted via CLI). */
  ids?: Set<string> | string[];
  minDefensiveMoves?: number;
  sourceProvider?: string;
  license?: string;
};

function emptyReport(): PipelineReport {
  return {
    candidatesAnalyzed: 0,
    candidatesAccepted: 0,
    rejectionReasons: {},
    familyDistribution: {},
    sources: {},
    materialSignatures: {},
    evalsBefore: [],
    evalsAfter: [],
    defensiveMoveCounts: [],
    duplicatesRemoved: 0,
    analysisTimeMs: 0,
    acceptedIds: [],
    generatedAt: new Date().toISOString(),
  };
}

function bump(
  map: Partial<Record<string, number>>,
  key: string,
  n = 1,
): void {
  map[key] = (map[key] ?? 0) + n;
}

function reject(report: PipelineReport, reason: RejectionReason): void {
  bump(report.rejectionReasons, reason);
}

async function* rowsFromOptions(
  options: RunPipelineOptions,
): AsyncGenerator<LichessPuzzleRow> {
  if (options.rows) {
    for (const row of options.rows) yield row;
    return;
  }
  if (!options.csvPath) {
    throw new Error('runPipeline: provide csvPath or rows');
  }
  for await (const row of iterLichessCsv(options.csvPath)) {
    yield row;
  }
}

/**
 * Default: without analyzer, structural filters only (eval windows skipped).
 * Production import should pass a Stockfish-backed PipelineAnalyzer.
 */
export async function runPipeline(
  options: RunPipelineOptions = {},
): Promise<PipelineResult> {
  const report = emptyReport();
  const started = Date.now();
  const idFilter =
    options.ids == null
      ? null
      : options.ids instanceof Set
        ? options.ids
        : new Set(options.ids);
  const dedupe = new FenDedupeSet();
  const positions: EndgameTrainingPosition[] = [];
  const provider = options.sourceProvider ?? 'lichess';
  const license = options.license ?? 'CC0-1.0';
  const importedAt = new Date().toISOString().slice(0, 10);

  if (options.analyzer?.engineVersion) {
    report.engineVersion = options.analyzer.engineVersion;
  }

  for await (const row of rowsFromOptions(options)) {
    if (options.limit != null && positions.length >= options.limit) break;

    if (idFilter && !idFilter.has(row.puzzleId)) {
      reject(report, 'id-filter');
      continue;
    }

    report.candidatesAnalyzed += 1;

    const fields = toPipelineFields(row);
    if (!fields) {
      reject(report, 'illegal-error-move');
      continue;
    }

    const structural = validateStartFen(fields.startFen);
    if (!structural.ok) {
      reject(report, structural.reason);
      continue;
    }

    if (!dedupe.tryAdd(fields.startFen)) {
      report.duplicatesRemoved += 1;
      reject(report, 'duplicate-fen');
      continue;
    }

    let evalBeforeCp = 0;
    let evalAfterCp = -300;
    let mateAfter: number | null = null;
    let defensiveMoveCount: number | undefined;

    if (options.analyzer) {
      try {
        const before = await options.analyzer.evaluate(
          fields.startFen,
          fields.defender,
        );
        const after = await options.analyzer.evaluate(
          fields.afterErrorFen,
          fields.defender,
        );
        evalBeforeCp = before.scoreCp;
        evalAfterCp = after.scoreCp;
        mateAfter = after.mateIn;
        defensiveMoveCount =
          before.defensiveMoveCount ?? after.defensiveMoveCount;

        if (!isNearDrawEval(evalBeforeCp)) {
          reject(report, 'not-near-draw');
          continue;
        }
        if (
          !isClearlyLostAfterError({
            scoreCp: evalAfterCp,
            mateIn: mateAfter,
          })
        ) {
          reject(report, 'after-error-not-lost');
          continue;
        }
        if (
          !meetsMinDefensiveMoves(
            defensiveMoveCount,
            options.minDefensiveMoves,
          )
        ) {
          reject(report, 'low-defensive-moves');
          continue;
        }
      } catch {
        reject(report, 'analyzer-error');
        continue;
      }
    }

    const position: EndgameTrainingPosition = {
      id: `LICHESS-${fields.puzzleId}`,
      fen: fields.startFen,
      defender: fields.defender,
      source: {
        provider,
        sourceId: fields.puzzleId,
        license,
        importedAt,
      },
      family: structural.family,
      materialSignature: structural.materialSignature,
      quality: {
        initialEvaluation: evalBeforeCp,
        validationKind: options.analyzer ? 'stockfish' : 'syzygy',
        defensiveMoveCount,
      },
    };

    positions.push(position);
    report.candidatesAccepted += 1;
    report.acceptedIds.push(position.id);
    bump(report.familyDistribution, structural.family);
    bump(report.sources, provider);
    bump(report.materialSignatures, structural.materialSignature);
    report.evalsBefore.push(evalBeforeCp);
    report.evalsAfter.push(evalAfterCp);
    if (defensiveMoveCount != null) {
      report.defensiveMoveCounts.push(defensiveMoveCount);
    }
  }

  report.analysisTimeMs = Date.now() - started;
  report.generatedAt = new Date().toISOString();
  return { positions, report };
}
