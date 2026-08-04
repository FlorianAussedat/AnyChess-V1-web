/**
 * Mixed repertoire training — pick lines from one or more folders.
 * Each exercise uses that folder's side for orientation and user moves.
 *
 * Selection is LINE-BASED (not folder-first): a folder with 20 lines
 * contributes 20 entries to the pool; a folder with 5 contributes 5.
 */
import type { ParsedRepertoire } from './types.ts';
import type { RepertoireFolder, RepertoireSide } from './storage/types.ts';
import {
  enumerateRepertoirePaths,
  sampleRandomPath,
} from '../continueLine/RepertoireBranchSelector.ts';
import type { ContinueLinePath } from '../continueLine/types.ts';

export type MixedRepertoireEntry = {
  folder: RepertoireFolder;
  repertoire: ParsedRepertoire;
};

export type MixedLinePick = {
  folderId: string;
  repertoireName: string;
  side: RepertoireSide;
  repertoire: ParsedRepertoire;
  path: ContinueLinePath;
};

/** Review-all / review-white / review-black selection filter. */
export type ReviewSideFilter = RepertoireSide | 'all';

/** Training modality chosen after a review scope. */
export type ReviewTrainingMode = 'continue' | 'board';

/** Stable key for recent-path history across a mixed selection. */
export function mixedTrainingKey(folderIds: string[]): string {
  return [...folderIds].sort().join('|');
}

/**
 * Filter folders for Review All / Review White / Review Black.
 * Folders without a side are never included.
 */
export function filterFoldersByReviewSide(
  folders: RepertoireFolder[],
  side: ReviewSideFilter,
): RepertoireFolder[] {
  if (side === 'all') {
    return folders.filter((f) => f.side === 'white' || f.side === 'black');
  }
  return folders.filter((f) => f.side === side);
}

/** Same filter applied to mixed training entries. */
export function filterEntriesByReviewSide(
  entries: MixedRepertoireEntry[],
  side: ReviewSideFilter,
): MixedRepertoireEntry[] {
  return entries.filter((entry) => {
    if (!entry.folder.side) return false;
    if (side === 'all') return true;
    return entry.folder.side === side;
  });
}

export type MixedPickOptions = {
  rng?: () => number;
  recentPathIds?: string[];
  maxAttempts?: number;
};

export function mixedLineKey(pick: Pick<MixedLinePick, 'folderId' | 'path'>): string {
  return `${pick.folderId}:${pick.path.id}`;
}

/**
 * Build the complete eligible line pool across folders (line-based fairness).
 */
export function buildMixedLinePool(entries: MixedRepertoireEntry[]): MixedLinePick[] {
  const pool: MixedLinePick[] = [];
  for (const entry of entries) {
    if (!entry.folder.side) continue;
    const paths = enumerateRepertoirePaths(entry.repertoire);
    for (const path of paths) {
      if (path.sans.length === 0) continue;
      pool.push({
        folderId: entry.folder.id,
        repertoireName: entry.folder.name,
        side: entry.folder.side,
        repertoire: entry.repertoire,
        path,
      });
    }
  }
  return pool;
}

/**
 * Path key blocked for a third consecutive repeat, if any.
 * recent[0] is newest.
 */
export function consecutiveRepeatBlock(
  recentPathIds: readonly string[] | undefined,
): string | null {
  if (!recentPathIds || recentPathIds.length < 2) return null;
  if (recentPathIds[0] === recentPathIds[1]) return recentPathIds[0] ?? null;
  return null;
}

/**
 * Pick a random line from the combined eligible pool.
 *
 * Rules:
 * - line-based fairness across folders;
 * - prefer lines not in recent history;
 * - never allow a 3rd consecutive identical selection when alternatives exist;
 * - if only one line exists, repeating it is allowed;
 * - never returns an empty pool when lines exist.
 */
export function pickMixedLine(
  entries: MixedRepertoireEntry[],
  options: MixedPickOptions = {},
): MixedLinePick | null {
  if (entries.length === 0) return null;

  const rng = options.rng ?? Math.random;
  const recent = options.recentPathIds ?? [];
  const recentSet = new Set(recent);
  const blocked = consecutiveRepeatBlock(recent);

  let pool = buildMixedLinePool(entries);

  // Fallback for empty enumeration (should be rare): sample one path per folder.
  if (pool.length === 0) {
    for (const entry of entries) {
      if (!entry.folder.side) continue;
      const path = sampleRandomPath(entry.repertoire, { rng, maxAttempts: 8 });
      if (!path || path.sans.length === 0) continue;
      pool.push({
        folderId: entry.folder.id,
        repertoireName: entry.folder.name,
        side: entry.folder.side,
        repertoire: entry.repertoire,
        path,
      });
    }
  }

  if (pool.length === 0) return null;

  let candidates =
    blocked != null ? pool.filter((p) => mixedLineKey(p) !== blocked) : pool;
  if (candidates.length === 0) candidates = pool;

  const fresh = candidates.filter((p) => !recentSet.has(mixedLineKey(p)));
  const preferred = fresh.length > 0 ? fresh : candidates;

  const idx = Math.floor(rng() * preferred.length);
  return preferred[idx] ?? null;
}

/** Player color for board orientation ('w' | 'b'). */
export function sideToPlayerColor(side: RepertoireSide): 'w' | 'b' {
  return side === 'white' ? 'w' : 'b';
}
