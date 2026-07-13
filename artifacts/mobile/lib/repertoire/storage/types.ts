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

export interface RepertoireFolder {
  id: string;
  name: string;
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
  importedAt: string;
  /** Raw PGN text as imported / replaced. */
  pgnText: string;
  summary: PgnParseSummary;
}

/** Full snapshot persisted by the storage backend. */
export interface RepertoireStoreSnapshot {
  version: 1;
  folders: RepertoireFolder[];
  files: StoredPgnFile[];
}

export function emptyRepertoireStore(): RepertoireStoreSnapshot {
  return { version: 1, folders: [], files: [] };
}
