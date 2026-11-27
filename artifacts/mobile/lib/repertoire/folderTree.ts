/**
 * Opening-library folder tree.
 *
 * Hierarchy is a parent id on each folder (`parentId`), never a path encoded
 * in the name. Missing `parentId` means a root of its color section. The
 * system folder « À classer » stays a root and cannot contain subfolders.
 *
 * Legacy v2 snapshots (0.0.6 and earlier) have no `parentId`. Migration fills
 * `null` and repairs dangling parents or cycles without new folder ids and
 * without rewriting PGN text.
 */
/** Same id as `UNFILED_OPENING_FOLDER_ID` (kept local to avoid a types cycle). */
const UNFILED_OPENING_FOLDER_ID = 'folder_system_unfiled';

export const OPENING_TREE_INDENT_STEP = 12;
export const OPENING_TREE_MAX_INDENT_DEPTH = 5;

export type TreeFolder = {
  id: string;
  name: string;
  parentId?: string | null;
  side?: 'white' | 'black';
  systemKey?: 'unfiled';
};

export type TreeFile = {
  id: string;
  folderId: string;
  filename: string;
  displayName?: string;
};

export function openingTreeIndent(depth: number): number {
  const level = Math.max(0, Math.min(depth, OPENING_TREE_MAX_INDENT_DEPTH));
  return level * OPENING_TREE_INDENT_STEP;
}

export function isUnfiledTreeFolder(
  folder: { id: string; systemKey?: string } | null | undefined,
): boolean {
  if (!folder) return false;
  return folder.systemKey === 'unfiled' || folder.id === UNFILED_OPENING_FOLDER_ID;
}

export function folderParentId(folder: { parentId?: string | null }): string | null {
  return typeof folder.parentId === 'string' && folder.parentId.length > 0
    ? folder.parentId
    : null;
}

export function isOpeningFolderRoot(folder: { parentId?: string | null }): boolean {
  return folderParentId(folder) === null;
}

/** Folder id plus every descendant. Cycles cannot loop forever. */
export function collectDescendantFolderIds(
  folders: readonly { id: string; parentId?: string | null }[],
  rootId: string,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const folder of folders) {
      if (folderParentId(folder) === id) queue.push(folder.id);
    }
  }
  return ids;
}

export function canMoveOpeningFolder(
  folders: readonly { id: string; parentId?: string | null }[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (newParentId == null) return true;
  return !collectDescendantFolderIds(folders, folderId).includes(newParentId);
}

export function openingFolderDepth(
  folders: readonly { id: string; parentId?: string | null }[],
  folderId: string,
): number {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let depth = 0;
  let current = byId.get(folderId);
  const guard = new Set<string>();
  while (current && folderParentId(current)) {
    if (guard.has(current.id)) break;
    guard.add(current.id);
    const parent = byId.get(folderParentId(current)!);
    if (!parent) break;
    depth += 1;
    current = parent;
    if (depth > 64) break;
  }
  return depth;
}

/** Same parent, or the same color root when there is no parent. */
export function openingSiblingScope(folder: {
  id?: string;
  parentId?: string | null;
  side?: string;
  systemKey?: string;
}): string {
  if (isUnfiledTreeFolder({ id: folder.id ?? '', systemKey: folder.systemKey })) {
    return 'system:unfiled';
  }
  const parent = folderParentId(folder);
  if (parent) return `parent:${parent}`;
  return `root:${folder.side ?? 'none'}`;
}

export function siblingFolderNameTaken(
  folders: readonly TreeFolder[],
  candidate: {
    id?: string;
    name: string;
    parentId?: string | null;
    side?: TreeFolder['side'];
    systemKey?: TreeFolder['systemKey'];
  },
): boolean {
  const scope = openingSiblingScope(candidate);
  const needle = candidate.name.trim().toLowerCase();
  if (!needle) return false;
  return folders.some((folder) => {
    if (candidate.id && folder.id === candidate.id) return false;
    if (openingSiblingScope(folder) !== scope) return false;
    return folder.name.trim().toLowerCase() === needle;
  });
}

export function uniqueSiblingFolderName(
  folders: readonly TreeFolder[],
  candidate: {
    id?: string;
    parentId?: string | null;
    side?: TreeFolder['side'];
    systemKey?: TreeFolder['systemKey'];
  },
  desired: string,
): string {
  const base = desired.trim() || 'Dossier';
  let name = base;
  let n = 2;
  while (siblingFolderNameTaken(folders, { ...candidate, name })) {
    name = `${base} (${n})`;
    n += 1;
  }
  return name;
}

export function listChildFolders<F extends TreeFolder>(
  folders: readonly F[],
  parentId: string | null,
): F[] {
  return folders
    .filter((folder) => folderParentId(folder) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

export function filesInFolderSubtree<T extends { folderId: string }>(
  files: readonly T[],
  folders: readonly { id: string; parentId?: string | null }[],
  rootId: string,
): T[] {
  const ids = new Set(collectDescendantFolderIds(folders, rootId));
  return files.filter((file) => ids.has(file.folderId));
}

function fileLabel(file: { filename: string; displayName?: string }): string {
  const named = file.displayName?.trim();
  return named || file.filename;
}

export type OpeningTreeFolderRow<F> = {
  kind: 'folder';
  folder: F;
  depth: number;
  expanded: boolean;
  directFolderCount: number;
  directFileCount: number;
};

export type OpeningTreeFileRow<File> = {
  kind: 'file';
  file: File;
  depth: number;
};

export type OpeningTreeRow<F, File> =
  | OpeningTreeFolderRow<F>
  | OpeningTreeFileRow<File>;

/**
 * Depth-first rows. Folders are emitted before studies at the same level.
 * A collapsed folder hides its own children; siblings stay independent.
 */
export function flattenOpeningTree<F extends TreeFolder, File extends TreeFile>(
  folders: readonly F[],
  files: readonly File[],
  roots: readonly F[],
  expanded: ReadonlySet<string>,
): OpeningTreeRow<F, File>[] {
  const childrenByParent = new Map<string, F[]>();
  for (const folder of folders) {
    const parent = folderParentId(folder);
    if (!parent) continue;
    const list = childrenByParent.get(parent) ?? [];
    list.push(folder);
    childrenByParent.set(parent, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }

  const filesByFolder = new Map<string, File[]>();
  for (const file of files) {
    const list = filesByFolder.get(file.folderId) ?? [];
    list.push(file);
    filesByFolder.set(file.folderId, list);
  }
  for (const list of filesByFolder.values()) {
    list.sort((a, b) =>
      fileLabel(a).localeCompare(fileLabel(b), 'fr', { sensitivity: 'base' }),
    );
  }

  const rows: OpeningTreeRow<F, File>[] = [];
  const walk = (folder: F, depth: number) => {
    const children = childrenByParent.get(folder.id) ?? [];
    const directFiles = filesByFolder.get(folder.id) ?? [];
    const isOpen = expanded.has(folder.id);
    rows.push({
      kind: 'folder',
      folder,
      depth,
      expanded: isOpen,
      directFolderCount: children.length,
      directFileCount: directFiles.length,
    });
    if (!isOpen) return;
    for (const child of children) walk(child, depth + 1);
    for (const file of directFiles) {
      rows.push({ kind: 'file', file, depth: depth + 1 });
    }
  };
  for (const root of roots) walk(root, 0);
  return rows;
}

export function flattenOpeningFoldersDepthFirst<F extends TreeFolder>(
  folders: readonly F[],
  roots: readonly F[],
): { folder: F; depth: number }[] {
  const expanded = new Set(folders.map((folder) => folder.id));
  return flattenOpeningTree(folders, [], roots, expanded).flatMap((row) =>
    row.kind === 'folder' ? [{ folder: row.folder, depth: row.depth }] : [],
  );
}

export type OpeningStoreLike<F extends TreeFolder = TreeFolder, File extends TreeFile = TreeFile> = {
  version: 2;
  folders: F[];
  files: File[];
  syncDeletedIds?: string[];
};

/**
 * Normalize parent links. Does not drop folders, files, PGN text, or stats.
 * Returns `changed` when the stored document should be rewritten.
 */
export function migrateOpeningHierarchy<F extends TreeFolder, File extends TreeFile>(
  snapshot: OpeningStoreLike<F, File>,
): { snapshot: OpeningStoreLike<F, File>; changed: boolean } {
  const folders = snapshot.folders.map((folder) => ({ ...folder }));
  const files = snapshot.files.map((file) => ({ ...file }));
  let changed = false;

  const originalRawParent = new Map(
    snapshot.folders.map((folder) => [folder.id, folder.parentId]),
  );

  for (const folder of folders) {
    const next = folderParentId(folder);
    if (folder.parentId !== next) changed = true;
    folder.parentId = next;
    if (isUnfiledTreeFolder(folder) && folder.parentId !== null) {
      folder.parentId = null;
      changed = true;
    }
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const unfiledIds = new Set(
    folders.filter((folder) => isUnfiledTreeFolder(folder)).map((folder) => folder.id),
  );

  for (const folder of folders) {
    const parent = folder.parentId;
    if (parent && (!byId.has(parent) || unfiledIds.has(parent))) {
      folder.parentId = null;
      changed = true;
    }
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string) => {
    const mark = state.get(id);
    if (mark === 'done' || mark === 'visiting') return;
    state.set(id, 'visiting');
    const folder = byId.get(id);
    const parent = folder?.parentId ?? null;
    if (folder && parent) {
      if (state.get(parent) === 'visiting') {
        folder.parentId = null;
        changed = true;
      } else {
        visit(parent);
      }
    }
    state.set(id, 'done');
  };
  for (const folder of folders) visit(folder.id);

  const folderIds = new Set(folders.map((folder) => folder.id));
  for (const file of files) {
    if (!folderIds.has(file.folderId)) {
      file.folderId = UNFILED_OPENING_FOLDER_ID;
      changed = true;
    }
  }

  for (const folder of folders) {
    if (originalRawParent.get(folder.id) !== folder.parentId) changed = true;
  }

  const next: OpeningStoreLike<F, File> = {
    ...snapshot,
    version: 2,
    folders,
    files,
  };
  return { snapshot: next, changed };
}
