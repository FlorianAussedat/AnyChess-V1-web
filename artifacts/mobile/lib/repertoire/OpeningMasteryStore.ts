/**
 * Sidecar persistence for opening-line Review history.
 *
 * Keyed by `${fileId}:${ContinueLinePath.id}` so PGN text is never rewritten
 * just to attach mastery. Missing keys = never reviewed = À travailler.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import {
  appendRevisionResult,
  isOpeningLineMastered,
  lastFiveRevisionResults,
  openingLineKey,
  type OpeningRevisionResult,
} from './openingMastery.ts';

const KEY = StorageKeys.openingLineMastery.key;

export type OpeningLineMasteryRecord = {
  recent: OpeningRevisionResult[];
  totalAttempts: number;
  totalSuccesses: number;
  lastRevisionAt: string;
};

export type OpeningLineMasterySnapshot = {
  version: 1;
  lines: Record<string, OpeningLineMasteryRecord>;
};

function emptySnapshot(): OpeningLineMasterySnapshot {
  return { version: 1, lines: {} };
}

function isResult(value: unknown): value is OpeningRevisionResult {
  return value === 'success' || value === 'failure';
}

function validateRecord(raw: unknown): OpeningLineMasteryRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (!Array.isArray(row.recent) || !row.recent.every(isResult)) return null;
  if (typeof row.totalAttempts !== 'number' || !Number.isFinite(row.totalAttempts)) return null;
  if (typeof row.totalSuccesses !== 'number' || !Number.isFinite(row.totalSuccesses)) return null;
  if (typeof row.lastRevisionAt !== 'string') return null;
  return {
    recent: lastFiveRevisionResults(row.recent),
    totalAttempts: Math.max(0, Math.floor(row.totalAttempts)),
    totalSuccesses: Math.max(0, Math.floor(row.totalSuccesses)),
    lastRevisionAt: row.lastRevisionAt,
  };
}

function validate(parsed: unknown): OpeningLineMasterySnapshot | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const row = parsed as { version?: unknown; lines?: unknown };
  if (row.version !== 1) return null;
  if (!row.lines || typeof row.lines !== 'object' || Array.isArray(row.lines)) return null;
  const lines: Record<string, OpeningLineMasteryRecord> = {};
  for (const [key, value] of Object.entries(row.lines as Record<string, unknown>)) {
    const rec = validateRecord(value);
    if (!rec) continue;
    lines[key] = rec;
  }
  return { version: 1, lines };
}

export class OpeningMasteryStore {
  private readonly storage: KeyValueStorage;
  private snapshot: OpeningLineMasterySnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  async ensureLoaded(): Promise<OpeningLineMasterySnapshot> {
    if (this.snapshot) return this.snapshot;
    const result = await loadStoredJson(this.storage, KEY, emptySnapshot(), validate);
    this.snapshot = result.value;
    return this.snapshot;
  }

  getSnapshot(): OpeningLineMasterySnapshot {
    return this.snapshot ?? emptySnapshot();
  }

  historyFor(fileId: string, pathId: string): OpeningRevisionResult[] {
    const rec = this.getSnapshot().lines[openingLineKey(fileId, pathId)];
    return rec ? [...rec.recent] : [];
  }

  historyByKey(key: string): OpeningRevisionResult[] {
    const rec = this.getSnapshot().lines[key];
    return rec ? [...rec.recent] : [];
  }

  isLineMastered(fileId: string, pathId: string): boolean {
    return isOpeningLineMastered(this.historyFor(fileId, pathId));
  }

  async recordResult(
    fileId: string,
    pathId: string,
    result: OpeningRevisionResult,
    at: string = new Date().toISOString(),
  ): Promise<OpeningLineMasteryRecord> {
    await this.ensureLoaded();
    const key = openingLineKey(fileId, pathId);
    const prev = this.snapshot!.lines[key];
    const recent = lastFiveRevisionResults(
      appendRevisionResult(prev?.recent ?? [], result),
    );
    const next: OpeningLineMasteryRecord = {
      recent,
      totalAttempts: (prev?.totalAttempts ?? 0) + 1,
      totalSuccesses: (prev?.totalSuccesses ?? 0) + (result === 'success' ? 1 : 0),
      lastRevisionAt: at,
    };
    this.snapshot = {
      version: 1,
      lines: { ...this.snapshot!.lines, [key]: next },
    };
    await this.persist();
    this.emit();
    return next;
  }

  async pruneFile(fileId: string): Promise<void> {
    await this.ensureLoaded();
    const prefix = `${fileId}:`;
    const lines = { ...this.snapshot!.lines };
    let changed = false;
    for (const key of Object.keys(lines)) {
      if (key.startsWith(prefix)) {
        delete lines[key];
        changed = true;
      }
    }
    if (!changed) return;
    this.snapshot = { version: 1, lines };
    await this.persist();
    this.emit();
  }

  async pruneFiles(fileIds: readonly string[]): Promise<void> {
    for (const id of fileIds) {
      await this.pruneFile(id);
    }
  }

  /** Drop records for a file whose path ids are no longer in the PGN. */
  async pruneOrphans(fileId: string, livePathIds: readonly string[]): Promise<void> {
    await this.ensureLoaded();
    const keep = new Set(livePathIds.map((pathId) => openingLineKey(fileId, pathId)));
    const prefix = `${fileId}:`;
    const lines = { ...this.snapshot!.lines };
    let changed = false;
    for (const key of Object.keys(lines)) {
      if (key.startsWith(prefix) && !keep.has(key)) {
        delete lines[key];
        changed = true;
      }
    }
    if (!changed) return;
    this.snapshot = { version: 1, lines };
    await this.persist();
    this.emit();
  }

  /** Test helper. */
  resetForTests(): void {
    this.snapshot = emptySnapshot();
  }

  private async persist(): Promise<void> {
    if (!this.snapshot) return;
    await this.storage.setItem(KEY, JSON.stringify(this.snapshot satisfies OpeningLineMasterySnapshot));
  }
}

export const openingMasteryStore = new OpeningMasteryStore(defaultKeyValueStorage);
