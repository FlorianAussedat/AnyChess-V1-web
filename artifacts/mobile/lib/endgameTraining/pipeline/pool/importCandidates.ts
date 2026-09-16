/**
 * Import Lichess puzzles into candidates.generated.json (streaming).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseLichessPuzzleRow,
  toPipelineFields,
  type LichessPuzzleRow,
} from '../lichessCsv.ts';
import { validateStartFen } from '../validateCandidate.ts';
import { FenDedupeSet } from '../qualityFilters.ts';
import { prefilterLichessRow } from './prefilter.ts';
import { inferEndgameFamily, inferTags, pieceCountFromFen } from './family.ts';
import { lichessPositionId } from './stableId.ts';
import { loadCandidates, saveCandidates, loadCuration } from './io.ts';
import { streamTextLines } from './streamZst.ts';
import { PATHS } from './paths.ts';
import type { CandidatesFile, PoolCandidate } from './types.ts';
import { POOL_SCHEMA_VERSION, PIPELINE_VERSION } from './types.ts';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export type ImportOptions = {
  input: string;
  seed?: string;
  maxCandidates?: number;
  maxRows?: number;
  outputPath?: string;
  cacheDir?: string;
};

export type ImportReport = {
  rowsScanned: number;
  prefiltered: number;
  imported: number;
  skippedExisting: number;
  rejectionReasons: Record<string, number>;
  sourceSha256?: string;
};

function sha256File(path: string): string | undefined {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch {
    return undefined;
  }
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export async function importLichessCandidates(
  options: ImportOptions,
): Promise<{ file: CandidatesFile; report: ImportReport }> {
  const outputPath = options.outputPath ?? PATHS.candidates;
  const seed = options.seed ?? 'anychess-v1';
  const maxCandidates = options.maxCandidates ?? 1000;
  const cacheDir = options.cacheDir ?? PATHS.cacheDir;
  mkdirSync(cacheDir, { recursive: true });

  const existing = loadCandidates(outputPath);
  const curation = loadCuration(PATHS.curation);
  const existingIds = new Set(existing.candidates.map((c) => c.positionId));
  const rejectedIds = new Set(
    Object.values(curation.decisions)
      .filter((d) => d.status === 'rejected')
      .map((d) => d.positionId),
  );

  const dedupe = new FenDedupeSet();
  for (const c of existing.candidates) {
    dedupe.tryAdd(c.initialFen);
  }

  const report: ImportReport = {
    rowsScanned: 0,
    prefiltered: 0,
    imported: 0,
    skippedExisting: 0,
    rejectionReasons: {},
    sourceSha256: sha256File(options.input),
  };

  const scored: Array<{ row: LichessPuzzleRow; score: number; fields: NonNullable<ReturnType<typeof toPipelineFields>> }> = [];
  const maxScoredBuffer = maxCandidates * 4;

  let headers: string[] | null = null;
  for await (const line of streamTextLines(options.input)) {
    if (options.maxRows != null && report.rowsScanned >= options.maxRows) break;
    if (scored.length >= maxScoredBuffer) break;
    if (!line.trim()) continue;

    if (!headers) {
      headers = splitCsvLine(line);
      continue;
    }

    report.rowsScanned += 1;
    const cells = splitCsvLine(line);
    const row = parseLichessPuzzleRow(headers, cells);
    if (!row) {
      bump(report.rejectionReasons, 'parse-error');
      continue;
    }

    const pf = prefilterLichessRow(row);
    if (!pf.ok) {
      bump(report.rejectionReasons, pf.reason);
      continue;
    }
    report.prefiltered += 1;

    const fields = toPipelineFields(row);
    if (!fields) {
      bump(report.rejectionReasons, 'illegal-error-move');
      continue;
    }

    const structural = validateStartFen(fields.startFen);
    if (!structural.ok) {
      bump(report.rejectionReasons, structural.reason);
      continue;
    }

    if (!dedupe.tryAdd(fields.startFen)) {
      bump(report.rejectionReasons, 'duplicate-fen');
      continue;
    }

    const positionId = lichessPositionId(row.puzzleId);
    if (existingIds.has(positionId) || rejectedIds.has(positionId)) {
      report.skippedExisting += 1;
      continue;
    }

    scored.push({ row, score: pf.score, fields });
  }

  scored.sort((a, b) => b.score - a.score || a.row.puzzleId.localeCompare(b.row.puzzleId));

  const newCandidates: PoolCandidate[] = [];
  for (const item of scored) {
    if (newCandidates.length >= maxCandidates) break;
    const { row, fields } = item;
    const positionId = lichessPositionId(row.puzzleId);
    const family = inferEndgameFamily(fields.startFen);
    const tags = inferTags(fields.startFen, row.themes);
    const gameUrl = row.raw['GameUrl'] || row.raw['gameurl'];

    newCandidates.push({
      positionId,
      initialFen: fields.startFen,
      playerColor: fields.defender,
      objective: 'DRAW',
      family,
      tags,
      materialSignature: structuralFromFen(fields.startFen),
      source: {
        provider: 'lichess-puzzle',
        sourceId: row.puzzleId,
        gameUrl: gameUrl || undefined,
        license: 'CC0-1.0',
        rating: row.rating,
        popularity: parseOptionalInt(row.raw['Popularity']),
        nbPlays: parseOptionalInt(row.raw['NbPlays']),
        themes: row.themes,
      },
      quality: {
        pieceCount: pieceCountFromFen(fields.startFen),
      },
      pipelineStatus: 'pending',
      importedAt: new Date().toISOString(),
      errorMoveUci: fields.errorMove,
    });
    report.imported += 1;
  }

  const merged: CandidatesFile = {
    schemaVersion: POOL_SCHEMA_VERSION,
    seed,
    sourceFile: options.input,
    sourceSha256: report.sourceSha256,
    generatedAt: new Date().toISOString(),
    candidates: [...existing.candidates, ...newCandidates],
  };

  saveCandidates(outputPath, merged);
  return { file: merged, report };
}

function structuralFromFen(fen: string): string {
  const v = validateStartFen(fen);
  return v.ok ? v.materialSignature : 'unknown';
}

function parseOptionalInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** Extract stored error move from candidate during certify. */
export function getCandidateErrorMove(candidate: PoolCandidate): string | null {
  return candidate.errorMoveUci ?? null;
}

export function resolveInputPath(input: string, cacheDir: string): string {
  if (existsSync(input)) return input;
  const cached = join(cacheDir, 'lichess_db_puzzle.csv.zst');
  if (existsSync(cached)) return cached;
  return input;
}

export { PIPELINE_VERSION };
