/**
 * Read/write pool data layer JSON files.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  CandidatesFile,
  CurationFile,
  ManualPositionsFile,
  PoolManifest,
  PoolBuildReport,
} from './types.ts';
import { POOL_SCHEMA_VERSION } from './types.ts';

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function loadCandidates(path: string): CandidatesFile {
  return readJson<CandidatesFile>(path, {
    schemaVersion: POOL_SCHEMA_VERSION,
    seed: '',
    generatedAt: '',
    candidates: [],
  });
}

export function saveCandidates(path: string, file: CandidatesFile): void {
  writeJson(path, file);
}

export function loadCuration(path: string): CurationFile {
  return readJson<CurationFile>(path, {
    schemaVersion: POOL_SCHEMA_VERSION,
    decisions: {},
  });
}

export function saveCuration(path: string, file: CurationFile): void {
  writeJson(path, file);
}

export function loadManualPositions(path: string): ManualPositionsFile {
  return readJson<ManualPositionsFile>(path, {
    schemaVersion: POOL_SCHEMA_VERSION,
    positions: [],
  });
}

export function saveManifest(path: string, manifest: PoolManifest): void {
  writeJson(path, manifest);
}

export function loadManifest(path: string): PoolManifest | null {
  if (!existsSync(path)) return null;
  return readJson<PoolManifest>(path, null as unknown as PoolManifest);
}

export function savePoolReport(path: string, report: PoolBuildReport): void {
  writeJson(path, report);
}

export function loadPoolReport(path: string): PoolBuildReport | null {
  if (!existsSync(path)) return null;
  return readJson<PoolBuildReport>(path, null as unknown as PoolBuildReport);
}
