/**
 * Persistent repertoire storage model.
 *
 * Folders group one or more PGN files into a single opening repertoire.
 * Parse stats are cached on each file at import time so the UI can show
 * useful info without re-parsing every render. The raw PGN text is kept so
 * the merged repertoire tree can be rebuilt on demand (e.g. when starting
 * an Opening Game in Stage 3).
 *
 * Migration (openings pool):
 * - Store remains version 2 (folders + files) on `anychess.repertoire.v2`.
 *   Hierarchy is an additive `folder.parentId` (0.0.7), not a new document key.
 * - Missing `parentId` migrates to `null` (a root). Ids, PGN text, comments,
 *   favorites, stats and review history are not rewritten.
 * - Missing `folder.enabled` / `file.enabled` means on (legacy snapshots).
 * - Missing `folder.side` stays unassigned until the user picks White or Black
 *   in Gérer les PGN; those folders are excluded from Review until then.
 * - Folders cannot be “both sides”; each folder is White XOR Black.
 *   A subfolder keeps its parent's side.
 */
import type { RepertoireIssue } from '../types';
import { migrateOpeningHierarchy } from '../folderTree.ts';

/** Which color the user trains this repertoire as. */
export type RepertoireSide = 'white' | 'black';

export interface RepertoireFolder {
  id: string;
  name: string;
  /**
   * Parent folder id. `null` (or missing, before migration) is a root of the
   * White, Black, or unassigned section. Independent of `name`.
   */
  parentId?: string | null;
  /** Side the user studies this repertoire from; required before training modes. */
  side?: RepertoireSide;
  /**
   * When false, every PGN in the folder is excluded from Review even if the
   * file flag is on. Missing (legacy) means enabled.
   */
  enabled?: boolean;
  /** Permanent catch-all folder — not user-deletable. Independent from game library. */
  systemKey?: 'unfiled';
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
  updatedAt?: string;
  /** Raw PGN text as imported / replaced. */
  pgnText: string;
  summary: PgnParseSummary;
  /**
   * When false, the file is kept in the library but excluded from training
   * merges (Review / Play). Defaults to true when missing (legacy snapshots).
   */
  enabled?: boolean;
  /**
   * Manual Learning pin. Missing (legacy) means not priority.
   * Has no effect on Review selection.
   */
  priority?: boolean;
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
  /** Tombstones so a deleted PGN/folder is not resurrected by another device. */
  syncDeletedIds?: string[];
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

/** Version coerce without rewriting parent links. */
export function coerceRepertoireStore(raw: unknown): RepertoireStoreSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as RepertoireStoreSnapshot | RepertoireStoreSnapshotV1;
  if (!Array.isArray(parsed.folders) || !Array.isArray(parsed.files)) return null;
  if (parsed.version !== 1 && parsed.version !== 2) return null;
  const deleted = Array.isArray((parsed as RepertoireStoreSnapshot).syncDeletedIds)
    ? (parsed as RepertoireStoreSnapshot).syncDeletedIds!.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
    : undefined;
  return deleted?.length
    ? { version: 2, folders: parsed.folders, files: parsed.files, syncDeletedIds: deleted }
    : { version: 2, folders: parsed.folders, files: parsed.files };
}

/** Normalize v1 snapshots and repair the folder tree. */
export function normalizeRepertoireStore(raw: unknown): RepertoireStoreSnapshot {
  const coerced = coerceRepertoireStore(raw);
  if (!coerced) return emptyRepertoireStore();
  return migrateOpeningHierarchy(coerced).snapshot;
}
