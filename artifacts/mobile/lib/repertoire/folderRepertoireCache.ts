/**
 * In-memory cache for merged folder repertoires.
 * Invalidated on import / delete / rename / structural folder changes.
 */
import type { ParsedRepertoire, RepertoireIssue } from './types.ts';

export type FolderRepertoireCacheEntry = {
  key: string;
  repertoire: ParsedRepertoire;
  fileCount: number;
  issues: RepertoireIssue[];
  builtAt: number;
  buildMs: number;
};

const cache = new Map<string, FolderRepertoireCacheEntry>();

export function makeFolderRepertoireCacheKey(
  folderId: string,
  fileFingerprints: string[],
): string {
  return `${folderId}::${fileFingerprints.join('|')}`;
}

export function getFolderRepertoireCache(
  key: string,
): FolderRepertoireCacheEntry | null {
  return cache.get(key) ?? null;
}

export function setFolderRepertoireCache(
  entry: FolderRepertoireCacheEntry,
): void {
  cache.set(entry.key, entry);
}

export function invalidateFolderRepertoireCache(folderId?: string): void {
  if (!folderId) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${folderId}::`)) cache.delete(key);
  }
}

/** Test-only. */
export function resetFolderRepertoireCacheForTests(): void {
  cache.clear();
}

export function repertoireCacheDevLog(
  kind: 'HIT' | 'MISS',
  detail: string,
): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[Repertoire cache ${kind}] ${detail}`);
  }
}
