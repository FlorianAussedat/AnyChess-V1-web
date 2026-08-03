/**
 * Mixed repertoire training — pick lines from one or more folders.
 * Each exercise uses that folder's side for orientation and user moves.
 */
import type { ParsedRepertoire } from './types.ts';
import type { RepertoireFolder, RepertoireSide } from './storage/types.ts';
import { sampleRandomPath } from '../continueLine/RepertoireBranchSelector.ts';
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
 * Pick a random folder from the pool, then a random path avoiding recent ids.
 */
export function pickMixedLine(
  entries: MixedRepertoireEntry[],
  options: MixedPickOptions = {},
): MixedLinePick | null {
  if (entries.length === 0) return null;

  const rng = options.rng ?? Math.random;
  const recent = new Set(options.recentPathIds ?? []);
  const maxAttempts = options.maxAttempts ?? 16;

  let fallback: MixedLinePick | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const idx = Math.floor(rng() * entries.length);
    const entry = entries[idx];
    if (!entry.folder.side) continue;

    const folderRecent = (options.recentPathIds ?? [])
      .filter((id) => id.startsWith(`${entry.folder.id}:`))
      .map((id) => id.slice(entry.folder.id.length + 1));

    const path = sampleRandomPath(entry.repertoire, {
      recentPathIds: folderRecent,
      rng,
      maxAttempts: 8,
    });
    if (!path || path.sans.length === 0) continue;

    const pick: MixedLinePick = {
      folderId: entry.folder.id,
      repertoireName: entry.folder.name,
      side: entry.folder.side,
      repertoire: entry.repertoire,
      path,
    };

    const pathKey = `${entry.folder.id}:${path.id}`;
    if (!recent.has(pathKey)) return pick;
    fallback = pick;
  }

  return fallback;
}

/** Player color for board orientation ('w' | 'b'). */
export function sideToPlayerColor(side: RepertoireSide): 'w' | 'b' {
  return side === 'white' ? 'w' : 'b';
}
