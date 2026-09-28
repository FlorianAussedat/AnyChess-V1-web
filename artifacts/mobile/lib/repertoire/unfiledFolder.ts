/**
 * System “À classer” folder for opening PGNs.
 * Independent from the game-analysis unfiled folder.
 */
import type { RepertoireFolder } from './storage/types.ts';

export const UNFILED_OPENING_FOLDER_ID = 'folder_system_unfiled';
export const UNFILED_OPENING_FOLDER_KEY = 'unfiled' as const;

export function isUnfiledOpeningFolder(
  folder: Pick<RepertoireFolder, 'id' | 'systemKey'> | null | undefined,
): boolean {
  if (!folder) return false;
  return (
    folder.systemKey === UNFILED_OPENING_FOLDER_KEY ||
    folder.id === UNFILED_OPENING_FOLDER_ID
  );
}

export function makeUnfiledOpeningFolder(now = new Date().toISOString()): RepertoireFolder {
  return {
    id: UNFILED_OPENING_FOLDER_ID,
    name: 'À classer',
    systemKey: UNFILED_OPENING_FOLDER_KEY,
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };
}
