/**
 * Review-pool activation: folder flag ANDs with file flag.
 * Missing `enabled` (legacy snapshots) means on.
 */
import type { RepertoireFolder, StoredPgnFile } from './storage/types.ts';

export function isFolderEnabledForReview(folder: RepertoireFolder): boolean {
  return folder.enabled !== false && (folder.side === 'white' || folder.side === 'black');
}

export function isFileEnabledForReview(
  folder: RepertoireFolder,
  file: StoredPgnFile,
): boolean {
  if (!isFolderEnabledForReview(folder)) return false;
  if (file.enabled === false) return false;
  return file.summary.parseSucceeded;
}

export function isFileVisibleInLearning(file: StoredPgnFile): boolean {
  return file.summary.parseSucceeded || file.pgnText.trim().length > 0;
}

/** True when moving a PGN would change its training orientation. */
export function needsOppositeSideMoveConfirm(
  fromFolder: RepertoireFolder | null | undefined,
  toFolder: RepertoireFolder | null | undefined,
): boolean {
  if (!fromFolder?.side || !toFolder?.side) return false;
  return fromFolder.side !== toFolder.side;
}
