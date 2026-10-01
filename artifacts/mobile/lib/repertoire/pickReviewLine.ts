/**
 * Review pick: uniform over every training line in the selected pool.
 * A 100-line PGN is ten times as likely as a 10-line PGN.
 * Mastery and Learning priority never change these odds.
 */
import type { ContinueLinePath } from '../continueLine/types.ts';
import { buildRepertoire } from './repertoireTree.ts';
import { isFileEnabledForReview } from './reviewActivation.ts';
import { hasAssignedRepertoireSide } from './folderSide.ts';
import type { RepertoireFolder, StoredPgnFile } from './storage/types.ts';
import type { RepertoireSide } from './storage/types.ts';
import { pgnFileDisplayName } from './storage/types.ts';
import {
  setEphemeralOpeningSession,
  type EphemeralOpeningSession,
} from './ephemeralOpeningSession.ts';

export type ReviewPoolEntry = {
  file: StoredPgnFile;
  folder: RepertoireFolder;
  side: RepertoireSide;
  paths: ContinueLinePath[];
};

export type ReviewLinePick = {
  file: StoredPgnFile;
  folder: RepertoireFolder;
  side: RepertoireSide;
  path: ContinueLinePath;
};

export function listReviewPoolEntries(
  folders: readonly RepertoireFolder[],
  files: readonly StoredPgnFile[],
): ReviewPoolEntry[] {
  const byFolder = new Map(folders.map((f) => [f.id, f]));
  const out: ReviewPoolEntry[] = [];
  for (const file of files) {
    const folder = byFolder.get(file.folderId);
    if (!folder || !hasAssignedRepertoireSide(folder.side)) continue;
    if (!isFileEnabledForReview(folder, file)) continue;
    const rep = buildRepertoire(file.pgnText);
    const paths = rep.trainingPaths ?? [];
    if (paths.length === 0) continue;
    out.push({ file, folder, side: folder.side, paths });
  }
  return out;
}

export function countReviewLines(entries: readonly ReviewPoolEntry[]): number {
  return entries.reduce((sum, e) => sum + e.paths.length, 0);
}

export type PickReviewLineOptions = {
  rng?: () => number;
  /** @deprecated Ignored — Review is uniform per line, not per file. */
  recentFileIds?: string[];
  /** @deprecated Ignored — Review is uniform per line. */
  recentPathIds?: string[];
};

export function flattenReviewLines(entries: readonly ReviewPoolEntry[]): ReviewLinePick[] {
  const out: ReviewLinePick[] = [];
  for (const entry of entries) {
    for (const path of entry.paths) {
      out.push({
        file: entry.file,
        folder: entry.folder,
        side: entry.side,
        path,
      });
    }
  }
  return out;
}

/**
 * Uniform draw among every line in the pool (1 / N).
 * Does not filter by mastery, priority, or recent history.
 */
export function pickReviewLine(
  entries: readonly ReviewPoolEntry[],
  options: PickReviewLineOptions = {},
): ReviewLinePick | null {
  const pool = flattenReviewLines(entries);
  if (pool.length === 0) return null;
  const rng = options.rng ?? Math.random;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index] ?? null;
}

const recentFileIds: string[] = [];
const recentPathIds: string[] = [];

export function rememberReviewPick(fileId: string, pathScopedId: string): void {
  recentFileIds.unshift(fileId);
  if (recentFileIds.length > 24) recentFileIds.length = 24;
  recentPathIds.unshift(pathScopedId);
  if (recentPathIds.length > 48) recentPathIds.length = 48;
}

export function resetReviewPickMemory(): void {
  recentFileIds.length = 0;
  recentPathIds.length = 0;
}

export function pickReviewLineFromMemory(
  entries: readonly ReviewPoolEntry[],
  rng?: () => number,
): ReviewLinePick | null {
  const pick = pickReviewLine(entries, {
    rng,
    recentFileIds,
    recentPathIds,
  });
  if (pick) rememberReviewPick(pick.file.id, `${pick.file.id}:${pick.path.id}`);
  return pick;
}

export function reviewPickToSession(
  pick: ReviewLinePick,
  origin: EphemeralOpeningSession['origin'],
): EphemeralOpeningSession {
  return {
    fileId: pick.file.id,
    folderId: pick.folder.id,
    pathSans: pick.path.sans,
    pathId: pick.path.id,
    sourcePgn: pick.file.pgnText,
    displayName: pgnFileDisplayName(pick.file),
    side: pick.side,
    origin,
  };
}

export function applyReviewPick(
  pick: ReviewLinePick,
  origin: EphemeralOpeningSession['origin'],
): EphemeralOpeningSession {
  const session = reviewPickToSession(pick, origin);
  setEphemeralOpeningSession(session);
  return session;
}
