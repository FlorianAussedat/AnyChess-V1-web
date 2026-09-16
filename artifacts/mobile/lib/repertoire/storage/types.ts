/**
 * Persistent repertoire storage model.
 *
 * Folders group one or more PGN files into a single opening repertoire.
 * Parse stats are cached on each file at import time so the UI can show
 * useful info without re-parsing every render. The raw PGN text is kept so
 * the merged repertoire tree can be rebuilt on demand (e.g. when starting
 * an Opening Game in Stage 3).
 */
import type { RepertoireIssue } from '../types';

/** Which color the user trains this repertoire as. */
export type RepertoireSide = 'white' | 'black';

export interface RepertoireFolder {
  id: string;
  name: string;
  /** Side the user studies this repertoire from; required before training modes. */
  side?: RepertoireSide;
  createdAt: string;
  updatedAt: string;
}

/** Cached parse result stored alongside each imported PGN. */
export interface PgnParseSummary {
  gameCount: number;
  positionCount: number;
  branchCount: number;
  /**
   * True when at least one legal branch was imported.
   * A file can succeed partially (some illegal lines reported in `errors`).
   */
  parseSucceeded: boolean;
  errors: RepertoireIssue[];
  warnings: RepertoireIssue[];
}

export interface StoredPgnFile {
  id: string;
  folderId: string;
  filename: string;
  /**
   * Display name in AnyChess only — does not rename the source file on disk.
   * Falls back to `filename` when unset.
   */
  displayName?: string;
  importedAt: string;
  /** Raw PGN text as imported / replaced. */
  pgnText: string;
  summary: PgnParseSummary;
  /**
   * When false, the file is kept in the library but excluded from training
   * merges (Review / Play). Defaults to true when missing (legacy snapshots).
   */
  enabled?: boolean;
}

/** Prefer displayName, else filename. */
export function pgnFileDisplayName(file: StoredPgnFile): string {
  const named = file.displayName?.trim();
  return named || file.filename;
}

/** Full snapshot persisted by the storage backend. */
export interface RepertoireStoreSnapshot {
  version: 2;
  folders: RepertoireFolder[];
  files: StoredPgnFile[];
}

/** Legacy on-disk shape (v1) before repertoire side metadata. */
export interface RepertoireStoreSnapshotV1 {
  version: 1;
  folders: RepertoireFolder[];
  files: StoredPgnFile[];
}

export function emptyRepertoireStore(): RepertoireStoreSnapshot {
  return { version: 2, folders: [], files: [] };
}

/** Normalize v1 snapshots and validate shape. */
export function normalizeRepertoireStore(raw: unknown): RepertoireStoreSnapshot {
  if (!raw || typeof raw !== 'object') return emptyRepertoireStore();
  const parsed = raw as RepertoireStoreSnapshot | RepertoireStoreSnapshotV1;
  if (!Array.isArray(parsed.folders) || !Array.isArray(parsed.files)) {
    return emptyRepertoireStore();
  }
  if (parsed.version === 1 || parsed.version === 2) {
    return { version: 2, folders: parsed.folders, files: parsed.files };
  }
  return emptyRepertoireStore();
}
