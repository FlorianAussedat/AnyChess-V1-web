/**
 * High-level repertoire management API.
 *
 * Owns folder / PGN-file CRUD, parses on import, caches parse summaries, and
 * can rebuild a merged position-keyed tree for a folder. The UI never talks
 * to AsyncStorage or the PGN parser directly.
 */
import { indexPgnGamesLight, extractPgnSlice } from '../gameLibrary/indexPgnGamesLight';
import { tMsg } from '@/lib/i18n';
import { combineFolderPgnTexts } from './combineFolderPgnTexts';
import { buildRepertoire } from './repertoireTree';
import type { ParsedRepertoire, RepertoireIssue } from './types';
import type { RepertoireStorage } from './storage/RepertoireStorage';
import { defaultRepertoireStorage } from './storage/AsyncStorageRepertoireStorage';
import type {
  PgnParseSummary,
  RepertoireFolder,
  RepertoireSide,
  RepertoireStoreSnapshot,
  StoredPgnFile,
} from './storage/types';
import { normaliseFilename, uniquePgnFilename } from './pgnFilename';
import {
  getFolderRepertoireCache,
  invalidateFolderRepertoireCache,
  makeFolderRepertoireCacheKey,
  repertoireCacheDevLog,
  setFolderRepertoireCache,
} from './folderRepertoireCache';
import { hasAssignedRepertoireSide, requireRepertoireSide } from './folderSide';
import {
  canMoveOpeningFolder,
  collectDescendantFolderIds,
  filesInFolderSubtree,
  isUnfiledTreeFolder,
  migrateOpeningHierarchy,
  siblingFolderNameTaken,
  uniqueSiblingFolderName,
} from './folderTree';
import {
  isUnfiledOpeningFolder,
  makeUnfiledOpeningFolder,
} from './unfiledFolder';
import { openingMasteryStore } from './OpeningMasteryStore';
import { prunePgnCommentFile, scheduleImportedPgnComments } from '../pgnComments/schedule.ts';

export { normaliseFilename, uniquePgnFilename } from './pgnFilename';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function summariseParse(pgnText: string): PgnParseSummary {
  const parsed = buildRepertoire(pgnText);
  return {
    gameCount: parsed.headers.length,
    positionCount: parsed.positionCount,
    branchCount: parsed.branchCount,
    parseSucceeded: parsed.positionCount > 0,
    errors: parsed.errors,
    warnings: parsed.warnings,
  };
}

export class RepertoireService {
  private snapshot: RepertoireStoreSnapshot | null = null;
  private loadPromise: Promise<RepertoireStoreSnapshot> | null = null;
  private readonly storage: RepertoireStorage;

  constructor(storage: RepertoireStorage = defaultRepertoireStorage) {
    this.storage = storage;
  }

  // ── Load / save ───────────────────────────────────────────────────────────

  async ensureLoaded(): Promise<RepertoireStoreSnapshot> {
    if (this.snapshot) return this.snapshot;
    if (!this.loadPromise) {
      this.loadPromise = this.storage.load().then(async (snap) => {
        const migrated = migrateOpeningHierarchy(snap);
        this.snapshot = migrated.snapshot;
        this.loadPromise = null;
        if (migrated.changed) await this.persist();
        await this.ensureUnfiledFolder();
        return this.snapshot!;
      });
    }
    return this.loadPromise;
  }

  private async persist(): Promise<void> {
    if (!this.snapshot) return;
    await this.storage.save(this.snapshot);
  }

  getFolders(): RepertoireFolder[] {
    if (!this.snapshot) return [];
    return [...this.snapshot.folders].sort((a, b) => {
      if (isUnfiledOpeningFolder(a) && !isUnfiledOpeningFolder(b)) return -1;
      if (!isUnfiledOpeningFolder(a) && isUnfiledOpeningFolder(b)) return 1;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
  }

  getFolder(folderId: string): RepertoireFolder | null {
    return this.snapshot?.folders.find((f) => f.id === folderId) ?? null;
  }

  getFiles(folderId: string): StoredPgnFile[] {
    if (!this.snapshot) return [];
    return this.snapshot.files
      .filter((f) => f.folderId === folderId)
      .sort((a, b) => a.filename.localeCompare(b.filename, 'fr', { sensitivity: 'base' }));
  }

  getFile(fileId: string): StoredPgnFile | null {
    return this.snapshot?.files.find((f) => f.id === fileId) ?? null;
  }

  // ── Folders ───────────────────────────────────────────────────────────────

  async ensureUnfiledFolder(): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const existing = this.snapshot!.folders.find((f) => isUnfiledOpeningFolder(f));
    if (existing) {
      if (existing.systemKey !== 'unfiled' || existing.enabled !== false) {
        existing.systemKey = 'unfiled';
        existing.enabled = false;
        existing.updatedAt = nowIso();
        await this.persist();
      }
      return existing;
    }
    const folder = makeUnfiledOpeningFolder();
    this.snapshot!.folders.unshift(folder);
    await this.persist();
    return folder;
  }

  async getUnfiledFolderId(): Promise<string> {
    const folder = await this.ensureUnfiledFolder();
    return folder.id;
  }

  async createFolder(
    name: string,
    side: RepertoireSide,
    enabled = true,
    parentId?: string | null,
  ): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const trimmed = name.trim();
    if (!trimmed) throw new Error(tMsg('errors.folderEmptyName'));
    const requestedSide = requireRepertoireSide(side);
    const parent = parentId
      ? this.snapshot!.folders.find((f) => f.id === parentId) ?? null
      : null;
    if (parentId && !parent) throw new Error(tMsg('errors.folderParentMissing'));
    if (parent && isUnfiledOpeningFolder(parent)) {
      throw new Error(tMsg('errors.systemFolderProtected'));
    }

    const assignedSide = parent && hasAssignedRepertoireSide(parent.side)
      ? parent.side
      : requestedSide;
    const nextParentId = parent ? parent.id : null;
    if (
      siblingFolderNameTaken(this.snapshot!.folders, {
        name: trimmed,
        parentId: nextParentId,
        side: assignedSide,
      })
    ) {
      throw new Error(tMsg('errors.folderExists', { name: trimmed }));
    }

    const folder: RepertoireFolder = {
      id: newId('folder'),
      name: trimmed,
      parentId: nextParentId,
      side: assignedSide,
      enabled,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.snapshot!.folders.push(folder);
    await this.persist();
    invalidateFolderRepertoireCache();
    return folder;
  }

  async renameFolder(folderId: string, name: string): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const trimmed = name.trim();
    if (!trimmed) throw new Error(tMsg('errors.folderEmptyName'));

    const folder = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(tMsg('errors.folderNotFound'));
    if (isUnfiledOpeningFolder(folder)) {
      throw new Error(tMsg('errors.systemFolderProtected'));
    }

    if (
      siblingFolderNameTaken(this.snapshot!.folders, {
        id: folder.id,
        name: trimmed,
        parentId: folder.parentId ?? null,
        side: folder.side,
        systemKey: folder.systemKey,
      })
    ) {
      throw new Error(tMsg('errors.folderExists', { name: trimmed }));
    }

    folder.name = trimmed;
    // Rename never clears a classified side (legacy unsided folders stay unsided).
    folder.updatedAt = nowIso();
    await this.persist();
    return folder;
  }

  /**
   * Deletes a folder. Studies are never removed.
   * An empty folder is deleted immediately. A folder that still contains
   * subfolders or studies requires `relocateContents`, which moves that
   * content to the parent (or, at the root, studies go to À classer and
   * subfolders become roots).
   */
  async deleteFolder(
    folderId: string,
    options?: { relocateContents?: boolean },
  ): Promise<void> {
    await this.ensureLoaded();
    const target = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!target) return;
    if (isUnfiledOpeningFolder(target)) {
      throw new Error(tMsg('errors.systemFolderProtected'));
    }
    const children = this.snapshot!.folders.filter((f) => (f.parentId ?? null) === folderId);
    const directFiles = this.snapshot!.files.filter((f) => f.folderId === folderId);
    if ((children.length > 0 || directFiles.length > 0) && !options?.relocateContents) {
      throw new Error(tMsg('errors.folderNotEmpty'));
    }
    if (options?.relocateContents) {
      const parent = target.parentId
        ? this.snapshot!.folders.find((f) => f.id === target.parentId) ?? null
        : null;
      const destParentId = parent?.id ?? null;
      const namePool = this.snapshot!.folders.filter((folder) => folder.id !== folderId);
      for (const child of children) {
        child.parentId = destParentId;
        child.name = uniqueSiblingFolderName(
          namePool,
          {
            id: child.id,
            parentId: destParentId,
            side: parent?.side ?? child.side,
            systemKey: child.systemKey,
          },
          child.name,
        );
        child.updatedAt = nowIso();
        if (parent && hasAssignedRepertoireSide(parent.side)) {
          this.applySideToSubtree(child.id, parent.side);
        }
      }
      const fileDestId = parent?.id ?? (await this.getUnfiledFolderId());
      for (const file of directFiles) {
        this.placeFileInFolder(file, fileDestId);
      }
    }
    this.snapshot!.folders = this.snapshot!.folders.filter((f) => f.id !== folderId);
    this.snapshot!.syncDeletedIds = [
      ...new Set([...(this.snapshot!.syncDeletedIds ?? []), folderId]),
    ];
    invalidateFolderRepertoireCache();
    await this.persist();
  }

  /** Persist which color the user trains this repertoire as. */
  async setFolderSide(folderId: string, side: RepertoireSide): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const folder = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(tMsg('errors.folderNotFound'));
    if (isUnfiledOpeningFolder(folder)) {
      throw new Error(tMsg('errors.systemFolderProtected'));
    }
    const assigned = requireRepertoireSide(side);
    if (folder.parentId) {
      const parent = this.snapshot!.folders.find((f) => f.id === folder.parentId);
      if (parent && hasAssignedRepertoireSide(parent.side) && parent.side !== assigned) {
        folder.parentId = null;
        folder.name = uniqueSiblingFolderName(
          this.snapshot!.folders,
          { id: folder.id, parentId: null, side: assigned, systemKey: folder.systemKey },
          folder.name,
        );
      }
    }
    this.applySideToSubtree(folder.id, assigned);
    await this.persist();
    return folder;
  }

  async setFolderEnabled(folderId: string, enabled: boolean): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const folder = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(tMsg('errors.folderNotFound'));
    if (isUnfiledOpeningFolder(folder)) {
      throw new Error(tMsg('errors.systemFolderProtected'));
    }
    folder.enabled = enabled;
    folder.updatedAt = nowIso();
    await this.persist();
    invalidateFolderRepertoireCache(folderId);
    return folder;
  }

  getAllFiles(): StoredPgnFile[] {
    if (!this.snapshot) return [];
    return [...this.snapshot.files];
  }

  /** Studies in this folder and every nested folder. Ids are unchanged. */
  getFilesInSubtree(folderId: string): StoredPgnFile[] {
    if (!this.snapshot) return [];
    return filesInFolderSubtree(this.snapshot.files, this.snapshot.folders, folderId)
      .sort((a, b) => a.filename.localeCompare(b.filename, 'fr', { sensitivity: 'base' }));
  }

  private applySideToSubtree(rootId: string, side: RepertoireSide): void {
    const ids = new Set(collectDescendantFolderIds(this.snapshot!.folders, rootId));
    const now = nowIso();
    for (const folder of this.snapshot!.folders) {
      if (!ids.has(folder.id) || isUnfiledOpeningFolder(folder)) continue;
      folder.side = side;
      folder.updatedAt = now;
    }
  }

  private placeFileInFolder(file: StoredPgnFile, targetFolderId: string): void {
    if (file.folderId === targetFolderId) return;
    const existingNames = this.snapshot!.files
      .filter((f) => f.folderId === targetFolderId && f.id !== file.id)
      .map((f) => f.filename);
    const fromFolderId = file.folderId;
    file.folderId = targetFolderId;
    file.filename = uniquePgnFilename(file.filename, existingNames);
    const from = this.snapshot!.folders.find((f) => f.id === fromFolderId);
    if (from) from.updatedAt = nowIso();
    const target = this.snapshot!.folders.find((f) => f.id === targetFolderId);
    if (target) target.updatedAt = nowIso();
  }

  /** Folders that have at least one parseable PGN and a training side set. */
  getTrainableFolders(): RepertoireFolder[] {
    if (!this.snapshot) return [];
    return this.getFolders().filter((folder) => {
      if (folder.enabled === false) return false;
      if (!hasAssignedRepertoireSide(folder.side)) return false;
      return this.getFilesInSubtree(folder.id).some(
        (f) => f.summary.parseSucceeded && f.enabled !== false,
      );
    });
  }

  /** Returns folders missing side among those with playable content. */
  getFoldersMissingSide(): RepertoireFolder[] {
    if (!this.snapshot) return [];
    return this.getFolders().filter((folder) => {
      if (isUnfiledOpeningFolder(folder)) return false;
      if (hasAssignedRepertoireSide(folder.side)) return false;
      return this.getFilesInSubtree(folder.id).some(
        (f) => f.summary.parseSucceeded && f.enabled !== false,
      );
    });
  }

  // ── PGN files ─────────────────────────────────────────────────────────────

  async importPgn(
    folderId: string,
    filename: string,
    pgnText: string,
    displayName?: string,
  ): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const folder = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(tMsg('errors.folderNotFound'));

    const text = pgnText.trim();
    if (!text) throw new Error(tMsg('errors.pgnEmpty'));

    const existingNames = this.snapshot!.files
      .filter((f) => f.folderId === folderId)
      .map((f) => f.filename);

    const file: StoredPgnFile = {
      id: newId('pgn'),
      folderId,
      filename: uniquePgnFilename(filename, existingNames),
      displayName: displayName?.trim() || undefined,
      importedAt: nowIso(),
      pgnText: text,
      summary: summariseParse(text),
      enabled: true,
    };

    this.snapshot!.files.push(file);
    folder.updatedAt = nowIso();
    invalidateFolderRepertoireCache(folderId);
    await this.persist();
    void scheduleImportedPgnComments(file.pgnText, 'repertoire', file.id);
    return file;
  }

  /** Replace an existing file's content (re-parses and updates stats). */
  async replacePgn(fileId: string, pgnText: string, filename?: string): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) throw new Error(tMsg('errors.pgnNotFound'));

    const text = pgnText.trim();
    if (!text) throw new Error(tMsg('errors.pgnEmpty'));

    file.pgnText = text;
    file.importedAt = nowIso();
    file.summary = summariseParse(text);
    if (filename) file.filename = normaliseFilename(filename);

    const folder = this.snapshot!.folders.find((f) => f.id === file.folderId);
    if (folder) folder.updatedAt = nowIso();

    invalidateFolderRepertoireCache(file.folderId);
    await this.persist();
    const liveIds = buildRepertoire(file.pgnText).trainingPaths?.map((p) => p.id) ?? [];
    await openingMasteryStore.pruneOrphans(file.id, liveIds);
    void scheduleImportedPgnComments(file.pgnText, 'repertoire', file.id);
    return file;
  }

  /** Enable/disable a PGN for training without deleting it. */
  async setFileEnabled(fileId: string, enabled: boolean): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) throw new Error(tMsg('errors.pgnNotFound'));
    file.enabled = enabled;
    const folder = this.snapshot!.folders.find((f) => f.id === file.folderId);
    if (folder) folder.updatedAt = nowIso();
    invalidateFolderRepertoireCache(file.folderId);
    await this.persist();
    return file;
  }

  /** Pin / unpin a PGN on the Learning screen. Does not affect Review. */
  async setFilePriority(fileId: string, priority: boolean): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) throw new Error(tMsg('errors.pgnNotFound'));
    file.priority = priority;
    const folder = this.snapshot!.folders.find((f) => f.id === file.folderId);
    if (folder) folder.updatedAt = nowIso();
    await this.persist();
    return file;
  }

  /** Remove one PGN file without deleting its parent folder. */
  async deletePgn(fileId: string): Promise<void> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) return;

    this.snapshot!.files = this.snapshot!.files.filter((f) => f.id !== fileId);
    this.snapshot!.syncDeletedIds = [
      ...new Set([...(this.snapshot!.syncDeletedIds ?? []), fileId]),
    ];
    const folder = this.snapshot!.folders.find((f) => f.id === file.folderId);
    if (folder) folder.updatedAt = nowIso();
    invalidateFolderRepertoireCache(file.folderId);
    await this.persist();
    await openingMasteryStore.pruneFile(fileId);
    await prunePgnCommentFile('repertoire', fileId);
  }

  /** Rename display name only (AnyChess UI) — does not touch disk filename. */
  async renamePgnDisplayName(fileId: string, displayName: string): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) throw new Error(tMsg('errors.pgnNotFound'));
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error(tMsg('errors.folderEmptyName'));
    file.displayName = trimmed;
    const folder = this.snapshot!.folders.find((f) => f.id === file.folderId);
    if (folder) folder.updatedAt = nowIso();
    await this.persist();
    return file;
  }

  /** Move a PGN into another openings folder (same content, one folder membership). */
  async movePgn(fileId: string, targetFolderId: string): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) throw new Error(tMsg('errors.pgnNotFound'));
    const target = this.snapshot!.folders.find((f) => f.id === targetFolderId);
    if (!target) throw new Error(tMsg('errors.folderNotFound'));
    if (file.folderId === targetFolderId) return file;

    this.placeFileInFolder(file, targetFolderId);
    invalidateFolderRepertoireCache();
    await this.persist();
    return file;
  }

  /** Move several studies into one folder. Each study keeps its id and PGN. */
  async movePgns(fileIds: readonly string[], targetFolderId: string): Promise<StoredPgnFile[]> {
    await this.ensureLoaded();
    const target = this.snapshot!.folders.find((f) => f.id === targetFolderId);
    if (!target) throw new Error(tMsg('errors.folderNotFound'));
    const moved: StoredPgnFile[] = [];
    for (const fileId of fileIds) {
      const file = this.snapshot!.files.find((f) => f.id === fileId);
      if (!file) throw new Error(tMsg('errors.pgnNotFound'));
      this.placeFileInFolder(file, targetFolderId);
      moved.push(file);
    }
    invalidateFolderRepertoireCache();
    await this.persist();
    return moved;
  }

  /**
   * Move a folder under `parentId` (`null` = root of `side`, or of its current side).
   * Descendants keep their relative places and follow the new side.
   */
  async moveFolder(
    folderId: string,
    parentId: string | null,
    side?: RepertoireSide,
  ): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const folder = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(tMsg('errors.folderNotFound'));
    if (isUnfiledOpeningFolder(folder) || isUnfiledTreeFolder(folder)) {
      throw new Error(tMsg('errors.systemFolderProtected'));
    }
    const parent = parentId
      ? this.snapshot!.folders.find((f) => f.id === parentId) ?? null
      : null;
    if (parentId && !parent) throw new Error(tMsg('errors.folderParentMissing'));
    if (parent && isUnfiledOpeningFolder(parent)) {
      throw new Error(tMsg('errors.systemFolderProtected'));
    }
    if (!canMoveOpeningFolder(this.snapshot!.folders, folderId, parentId)) {
      throw new Error(tMsg('errors.folderCycle'));
    }
    const nextSide = parent && hasAssignedRepertoireSide(parent.side)
      ? parent.side
      : side && hasAssignedRepertoireSide(side)
        ? side
        : folder.side;
    const nextParentId = parent?.id ?? null;
    if ((folder.parentId ?? null) === nextParentId && folder.side === nextSide) {
      return folder;
    }
    if (
      siblingFolderNameTaken(this.snapshot!.folders, {
        id: folder.id,
        name: folder.name,
        parentId: nextParentId,
        side: nextSide,
        systemKey: folder.systemKey,
      })
    ) {
      throw new Error(tMsg('errors.folderExists', { name: folder.name }));
    }
    folder.parentId = nextParentId;
    if (hasAssignedRepertoireSide(nextSide)) this.applySideToSubtree(folder.id, nextSide);
    else folder.updatedAt = nowIso();
    invalidateFolderRepertoireCache();
    await this.persist();
    return folder;
  }

  /**
   * Copy PGN content into another folder (same source may live in several folders).
   * Used by Bibliothèque → Ouvertures and multi-folder presence.
   */
  async copyPgnToFolder(
    fileId: string,
    targetFolderId: string,
  ): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) throw new Error(tMsg('errors.pgnNotFound'));
    return this.importPgn(
      targetFolderId,
      file.filename,
      file.pgnText,
      file.displayName,
    );
  }

  // ── Merged repertoire tree ────────────────────────────────────────────────

  private scopedFolderFiles(
    folderId: string,
    fileId?: string,
    gameIndex?: number,
  ): StoredPgnFile[] {
    return this.getFilesInSubtree(folderId)
      .filter((f) => f.enabled !== false && (!fileId || f.id === fileId))
      .map((file) => {
        if (!fileId || gameIndex === undefined) return file;
        const entry = indexPgnGamesLight(file.pgnText).entries.find(
          (e) => e.index === gameIndex,
        );
        return { ...file, pgnText: entry ? extractPgnSlice(file.pgnText, entry) : '' };
      });
  }

  /**
   * Merge every PGN in a folder into one position-keyed repertoire tree.
   * Duplicate moves from the same position are de-duplicated by buildRepertoire;
   * transpositions are matched by position key (not move order).
   */
  async buildFolderRepertoire(folderId: string, fileId?: string, gameIndex?: number): Promise<{
    repertoire: ParsedRepertoire;
    fileCount: number;
    issues: RepertoireIssue[];
  }> {
    await this.ensureLoaded();
    const files = this.scopedFolderFiles(folderId, fileId, gameIndex);
    if (files.length === 0) {
      return {
        repertoire: {
          index: new Map(),
          headers: [],
          errors: [],
          warnings: [],
          branchCount: 0,
          positionCount: 0,
        },
        fileCount: 0,
        issues: [{ message: 'Aucun fichier PGN actif dans ce dossier.' }],
      };
    }

    const fingerprints = files.map(
      (f) => `${f.id}:${f.importedAt}:${f.pgnText.length}:${f.summary.positionCount}`,
    );
    const cacheKey = makeFolderRepertoireCacheKey(folderId, [`scope:${fileId ?? "all"}:${gameIndex ?? "all"}`, ...fingerprints]);
    const cached = getFolderRepertoireCache(cacheKey);
    if (cached) {
      repertoireCacheDevLog('HIT', `${folderId} (${cached.buildMs}ms cached)`);
      return {
        repertoire: cached.repertoire,
        fileCount: cached.fileCount,
        issues: cached.issues,
      };
    }

    const t0 =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const combined = combineFolderPgnTexts(files);
    const repertoire = buildRepertoire(combined);

    const issues: RepertoireIssue[] = [];
    for (const file of files) {
      for (const err of file.summary.errors) {
        issues.push({
          ...err,
          message: `[${file.filename}] ${err.message}`,
        });
      }
    }
    for (const err of repertoire.errors) {
      if (!issues.some((i) => i.message.includes(err.message) && i.context === err.context)) {
        issues.push(err);
      }
    }

    const t1 =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const buildMs = Math.round(t1 - t0);
    repertoireCacheDevLog('MISS', `Build repertoire: ${buildMs} ms`);
    setFolderRepertoireCache({
      key: cacheKey,
      repertoire,
      fileCount: files.length,
      issues,
      builtAt: Date.now(),
      buildMs,
    });

    return { repertoire, fileCount: files.length, issues };
  }

  /**
   * Combined source PGN of enabled files in a folder (same text used to build
   * the repertoire tree). Optional `fileId` / `gameIndex` match the scoped
   * repertoire used during training so analyzer comments stay on that branch.
   */
  getFolderCombinedPgn(folderId: string, fileId?: string, gameIndex?: number): string {
    if (!this.snapshot) return '';
    return combineFolderPgnTexts(this.scopedFolderFiles(folderId, fileId, gameIndex));
  }
}

/** Shared singleton for the app. */
export const repertoireService = new RepertoireService();

