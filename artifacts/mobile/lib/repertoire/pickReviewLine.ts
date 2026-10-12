/**
 * Uniform draw among every complete line in the admissible pool.
 * One draw over the flat list, not a folder then a file then a branch.
 * A shared prefix is not its own line. Identical move sequences inside one
 * PGN collapse to one line; the same sequence stored in two files stays two
 * lines. Mastery, priority, file order and recent history never change the odds.
 * A repeat in a later draw is allowed and is not a bias.
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
import { reviewLineDisplayName } from './reviewLineName.ts';

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
  /** Session color. Omit on the first draw so every active side is eligible. */
  side?: RepertoireSide;
  /** @deprecated Ignored — a repeat is allowed and is not a bias. */
  recentFileIds?: string[];
  /** @deprecated Ignored — a repeat is allowed and is not a bias. */
  recentPathIds?: string[];
};

/** Index into a flat line list. `rng` of 0 picks the first, just under 1 the last. */
export function uniformLineIndex(length: number, rng: () => number): number {
  if (length <= 0) return 0;
  const sample = rng();
  const unit = Number.isFinite(sample) ? sample : 0;
  return Math.min(length - 1, Math.max(0, Math.floor(unit * length)));
}

export function eligibleReviewLines(
  entries: readonly ReviewPoolEntry[],
  options: PickReviewLineOptions = {},
): ReviewLinePick[] {
  const lines = flattenReviewLines(entries);
  if (!options.side) return lines;
  return lines.filter((line) => line.side === options.side);
}

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
  const pool = eligibleReviewLines(entries, options);
  if (pool.length === 0) return null;
  const rng = options.rng ?? Math.random;
  return pool[uniformLineIndex(pool.length, rng)] ?? null;
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
  side?: RepertoireSide,
): ReviewLinePick | null {
  const pick = pickReviewLine(entries, {
    rng,
    side,
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
    lineName: reviewLineDisplayName({
      pathLabel: pick.path.sourceLabel,
      fileDisplayName: pgnFileDisplayName(pick.file),
    }),
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
