/**
 * Mixed repertoire training — pick lines from one or more folders.
 * Each exercise uses that folder's side for orientation and user moves.
 */
import type { ParsedRepertoire } from './types.ts';
import type { RepertoireFolder, RepertoireSide } from './storage/types.ts';
import { trainingPaths, pickBalanced } from '../continueLine/RepertoireBranchSelector.ts';
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

/**
 * Pick uniformly across complete imported paths, regardless of folder size.
 */
export function pickMixedLine(
  entries: MixedRepertoireEntry[],
  options: MixedPickOptions = {},
): MixedLinePick | null {
  const pool: MixedLinePick[] = entries.flatMap(entry => entry.folder.side
    ? trainingPaths(entry.repertoire).map(path => ({
        folderId: entry.folder.id, repertoireName: entry.folder.name,
        side: entry.folder.side!, repertoire: entry.repertoire, path,
      })) : []);
  return pickBalanced(pool, p => `${p.folderId}:${p.path.id}`, options.recentPathIds ?? [], options.rng ?? Math.random);
}

/** Player color for board orientation ('w' | 'b'). */
export function sideToPlayerColor(side: RepertoireSide): 'w' | 'b' {
  return side === 'white' ? 'w' : 'b';
}

