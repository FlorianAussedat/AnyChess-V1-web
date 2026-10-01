/**
 * Learning lists stay inside one existing folder.
 * Callers pass the files they already loaded; this does not invent folders.
 */
export function learningFilesInFolder<T extends { folderId: string }>(
  files: readonly T[],
  folderId: string,
): T[] {
  return files.filter((file) => file.folderId === folderId);
}
