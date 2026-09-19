/**
 * Balanced Review pick: first a PGN, then a line inside that PGN.
 * Large files cannot drown small ones.
 */
import { pickBalanced } from '../continueLine/RepertoireBranchSelector.ts';
import type { ContinueLinePath } from '../continueLine/types.ts';
import { buildRepertoire } from './repertoireTree.ts';
import { isFileEnabledForReview } from './reviewActivation.ts';
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
    if (!folder || !folder.side) continue;
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
  /** Recent file ids, newest first. */
  recentFileIds?: string[];
  /** Recent path ids scoped as `${fileId}:${pathId}`. */
  recentPathIds?: string[];
};

/**
 * 1) pick a PGN uniformly among active files (avoiding recent files first)
 * 2) pick a path uniformly inside that PGN
 */
export function pickReviewLine(
  entries: readonly ReviewPoolEntry[],
  options: PickReviewLineOptions = {},
): ReviewLinePick | null {
  if (entries.length === 0) return null;
  const rng = options.rng ?? Math.random;
  const filePick = pickBalanced(
    [...entries],
    (e) => e.file.id,
    options.recentFileIds ?? [],
    rng,
  );
  if (!filePick) return null;
  const path = pickBalanced(
    filePick.paths,
    (p) => `${filePick.file.id}:${p.id}`,
    options.recentPathIds ?? [],
    rng,
  );
  if (!path) return null;
  return {
    file: filePick.file,
    folder: filePick.folder,
    side: filePick.side,
    path,
  };
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
