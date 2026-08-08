/**
 * High-level repertoire management API.
 *
 * Owns folder / PGN-file CRUD, parses on import, caches parse summaries, and
 * can rebuild a merged position-keyed tree for a folder. The UI never talks
 * to AsyncStorage or the PGN parser directly.
 */
import { tMsg } from '@/lib/i18n';
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

  constructor(private readonly storage: RepertoireStorage = defaultRepertoireStorage) {}

  // ── Load / save ───────────────────────────────────────────────────────────

  async ensureLoaded(): Promise<RepertoireStoreSnapshot> {
    if (this.snapshot) return this.snapshot;
    if (!this.loadPromise) {
      this.loadPromise = this.storage.load().then((snap) => {
        this.snapshot = snap;
        this.loadPromise = null;
        return snap;
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
    return [...this.snapshot.folders].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
    );
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

  async createFolder(name: string): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const trimmed = name.trim();
    if (!trimmed) throw new Error(tMsg('errors.folderEmptyName'));

    const existing = this.snapshot!.folders.find(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) throw new Error(tMsg('errors.folderExists', { name: trimmed }));

    const folder: RepertoireFolder = {
      id: newId('folder'),
      name: trimmed,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.snapshot!.folders.push(folder);
    await this.persist();
    return folder;
  }

  async renameFolder(folderId: string, name: string): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const trimmed = name.trim();
    if (!trimmed) throw new Error(tMsg('errors.folderEmptyName'));

    const folder = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(tMsg('errors.folderNotFound'));

    const clash = this.snapshot!.folders.find(
      (f) => f.id !== folderId && f.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (clash) throw new Error(tMsg('errors.folderExists', { name: trimmed }));

    folder.name = trimmed;
    folder.updatedAt = nowIso();
    await this.persist();
    return folder;
  }

  /**
   * Deletes a folder and every PGN file it contains.
   * Callers must confirm with the user before invoking this.
   */
  async deleteFolder(folderId: string): Promise<void> {
    await this.ensureLoaded();
    this.snapshot!.folders = this.snapshot!.folders.filter((f) => f.id !== folderId);
    this.snapshot!.files = this.snapshot!.files.filter((f) => f.folderId !== folderId);
    await this.persist();
  }

  /** Persist which color the user trains this repertoire as. */
  async setFolderSide(folderId: string, side: RepertoireSide): Promise<RepertoireFolder> {
    await this.ensureLoaded();
    const folder = this.snapshot!.folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(tMsg('errors.folderNotFound'));
    folder.side = side;
    folder.updatedAt = nowIso();
    await this.persist();
    return folder;
  }

  /** Folders that have at least one parseable PGN and a training side set. */
  getTrainableFolders(): RepertoireFolder[] {
    if (!this.snapshot) return [];
    return this.getFolders().filter((folder) => {
      if (!folder.side) return false;
      return this.getFiles(folder.id).some(
        (f) => f.summary.parseSucceeded && f.enabled !== false,
      );
    });
  }

  /** Returns folders missing side among those with playable content. */
  getFoldersMissingSide(): RepertoireFolder[] {
    if (!this.snapshot) return [];
    return this.getFolders().filter((folder) => {
      if (folder.side) return false;
      return this.getFiles(folder.id).some(
        (f) => f.summary.parseSucceeded && f.enabled !== false,
      );
    });
  }

  // ── PGN files ─────────────────────────────────────────────────────────────

  async importPgn(
    folderId: string,
    filename: string,
    pgnText: string,
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
      importedAt: nowIso(),
      pgnText: text,
      summary: summariseParse(text),
      enabled: true,
    };

    this.snapshot!.files.push(file);
    folder.updatedAt = nowIso();
    await this.persist();
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

    await this.persist();
    return file;
  }

  /** Enable/disable a PGN for training without deleting it. */
  async setFileEnabled(fileId: string, enabled: boolean): Promise<StoredPgnFile> {
    await this.ensureLoaded();
    const file = this.snapshot!.files.find((f) => f.id === fileId);
    if (!file) throw new Error('Fichier PGN introuvable.');
    file.enabled = enabled;
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
    const folder = this.snapshot!.folders.find((f) => f.id === file.folderId);
    if (folder) folder.updatedAt = nowIso();
    await this.persist();
  }

  // ── Merged repertoire tree ────────────────────────────────────────────────

  /**
   * Merge every PGN in a folder into one position-keyed repertoire tree.
   * Duplicate moves from the same position are de-duplicated by buildRepertoire;
   * transpositions are matched by position key (not move order).
   */
  async buildFolderRepertoire(folderId: string): Promise<{
    repertoire: ParsedRepertoire;
    fileCount: number;
    issues: RepertoireIssue[];
  }> {
    await this.ensureLoaded();
    const files = this.getFiles(folderId).filter((f) => f.enabled !== false);
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

    const combined = files
      .map((f) => {
        // Inject a Source header so deviation analysis can name the file.
        const hasHeaders = /^\s*\[/.test(f.pgnText);
        const sourceTag = `[Source "${f.filename.replace(/"/g, '')}"]\n`;
        return hasHeaders ? `${sourceTag}${f.pgnText}` : `${sourceTag}\n${f.pgnText}`;
      })
      .join('\n\n');
    const repertoire = buildRepertoire(combined);

    // Surface per-file issues with the filename for clarity.
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
      // Avoid duplicating if already covered by per-file summaries.
      if (!issues.some((i) => i.message.includes(err.message) && i.context === err.context)) {
        issues.push(err);
      }
    }

    return { repertoire, fileCount: files.length, issues };
  }
}

/** Shared singleton for the app. */
export const repertoireService = new RepertoireService();
