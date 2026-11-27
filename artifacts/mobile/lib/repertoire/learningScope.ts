/**
 * Studies the user can train from one folder.
 * When `folders` is provided, nested folders are included so a parent such as
 * « Dragon accéléré » covers every study under it. Without `folders`, only
 * the folder's own studies are returned (direct membership).
 */
export function learningFilesInFolder<T extends { folderId: string }>(
  files: readonly T[],
  folderId: string,
  folders?: readonly { id: string; parentId?: string | null }[],
): T[] {
  if (!folders) return files.filter((file) => file.folderId === folderId);
  const ids = new Set<string>();
  const queue = [folderId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const folder of folders) {
      if ((folder.parentId ?? null) === id) queue.push(folder.id);
    }
  }
  return files.filter((file) => ids.has(file.folderId));
}
