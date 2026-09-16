/**
 * React hook wrapping RepertoireService for the Openings management screens.
 * Keeps a local refresh counter so list UIs re-render after mutations.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  repertoireService,
  type RepertoireFolder,
  type RepertoireSide,
  type StoredPgnFile,
} from '@/lib/repertoire';

export function useRepertoireLibrary() {
  const [ready, setReady] = useState(false);
  const [folders, setFolders] = useState<RepertoireFolder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      await repertoireService.ensureLoaded();
      setFolders(repertoireService.getFolders());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, tick]);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const createFolder = useCallback(
    async (name: string) => {
      const folder = await repertoireService.createFolder(name);
      bump();
      return folder;
    },
    [bump],
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      const folder = await repertoireService.renameFolder(folderId, name);
      bump();
      return folder;
    },
    [bump],
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      await repertoireService.deleteFolder(folderId);
      bump();
    },
    [bump],
  );

  const getFiles = useCallback((folderId: string): StoredPgnFile[] => {
    return repertoireService.getFiles(folderId);
  }, [tick]);

  const importPgn = useCallback(
    async (
      folderId: string,
      filename: string,
      pgnText: string,
      displayName?: string,
    ) => {
      const file = await repertoireService.importPgn(
        folderId,
        filename,
        pgnText,
        displayName,
      );
      bump();
      return file;
    },
    [bump],
  );

  const renamePgnDisplayName = useCallback(
    async (fileId: string, displayName: string) => {
      const file = await repertoireService.renamePgnDisplayName(fileId, displayName);
      bump();
      return file;
    },
    [bump],
  );

  const movePgn = useCallback(
    async (fileId: string, targetFolderId: string) => {
      const file = await repertoireService.movePgn(fileId, targetFolderId);
      bump();
      return file;
    },
    [bump],
  );

  const copyPgnToFolder = useCallback(
    async (fileId: string, targetFolderId: string) => {
      const file = await repertoireService.copyPgnToFolder(fileId, targetFolderId);
      bump();
      return file;
    },
    [bump],
  );

  const replacePgn = useCallback(
    async (fileId: string, pgnText: string, filename?: string) => {
      const file = await repertoireService.replacePgn(fileId, pgnText, filename);
      bump();
      return file;
    },
    [bump],
  );

  const deletePgn = useCallback(
    async (fileId: string) => {
      await repertoireService.deletePgn(fileId);
      bump();
    },
    [bump],
  );

  const setFileEnabled = useCallback(
    async (fileId: string, enabled: boolean) => {
      const file = await repertoireService.setFileEnabled(fileId, enabled);
      bump();
      return file;
    },
    [bump],
  );

  const getFolder = useCallback(
    (folderId: string) => repertoireService.getFolder(folderId),
    [tick],
  );

  const setFolderSide = useCallback(
    async (folderId: string, side: RepertoireSide) => {
      const folder = await repertoireService.setFolderSide(folderId, side);
      bump();
      return folder;
    },
    [bump],
  );

  const getTrainableFolders = useCallback(
    () => repertoireService.getTrainableFolders(),
    [tick],
  );

  const getFoldersMissingSide = useCallback(
    () => repertoireService.getFoldersMissingSide(),
    [tick],
  );

  return {
    ready,
    folders,
    error,
    refresh,
    createFolder,
    renameFolder,
    deleteFolder,
    getFolder,
    getFiles,
    importPgn,
    replacePgn,
    deletePgn,
    renamePgnDisplayName,
    movePgn,
    copyPgnToFolder,
    setFileEnabled,
    setFolderSide,
    getTrainableFolders,
    getFoldersMissingSide,
  };
}
