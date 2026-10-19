import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import { useOpeningTreeExpanded } from '@/hooks/useOpeningTreeExpanded';
import {
  hasAssignedRepertoireSide,
  isOpeningFolderRoot,
  isUnfiledOpeningFolder,
  listChildFolders,
  needsOppositeSideMoveConfirm,
  pgnFileDisplayName,
  selectedPgnImports,
  type RepertoireFolder,
  type RepertoireSide,
  type StoredPgnFile,
} from '@/lib/repertoire';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import {
  indexPgnGamesLight,
  MAX_OPENINGS_PGN_IMPORT_BATCH,
  type PgnGameIndexEntry,
} from '@/lib/gameLibrary';
import { parkExternalOpeningPgn } from '@/lib/openingStudy';
import { confirmAction } from '@/lib/openings/confirmAction';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LibraryFolderFab } from '@/components/library/LibraryFolderFab';
import { DesignTokens } from '@/constants/designTokens';
import { NameModal } from '@/components/openings/NameModal';
import { FolderPickModal } from '@/components/openings/FolderPickModal';
import { ManageOpeningTree } from '@/components/openings/ManageOpeningTree';
import { RepertoireSidePicker, sideLabel } from '@/components/RepertoireSidePicker';
import {
  PgnGameSelectModal,
  type PgnGameSelectCandidate,
} from '@/components/parties/PgnGameSelectModal';

type PendingImport = {
  filename: string;
  sourceText: string;
  entries: PgnGameIndexEntry[];
  selectedIndices: number[];
};

export default function OpeningsManageScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();

  const {
    ready,
    folders,
    error,
    createFolder,
    renameFolder,
    deleteFolder,
    getFiles,
    getAllFiles,
    importPgn,
    deletePgn,
    renamePgnDisplayName,
    movePgn,
    movePgns,
    moveFolder,
    setFolderSide,
    setFolderEnabled,
    setFileEnabled,
  } = useRepertoireLibrary();
  const { expanded, toggle: toggleExpanded, expand: expandFolders } = useOpeningTreeExpanded();

  const [createOpen, setCreateOpen] = useState(false);
  const [createSide, setCreateSide] = useState<RepertoireSide | null>(null);
  const [createParent, setCreateParent] = useState<RepertoireFolder | null>(null);
  const [renameTarget, setRenameTarget] = useState<RepertoireFolder | null>(null);
  const [renameFile, setRenameFile] = useState<StoredPgnFile | null>(null);
  const [moveFile, setMoveFile] = useState<StoredPgnFile | null>(null);
  const [moveFileIds, setMoveFileIds] = useState<string[] | null>(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState<RepertoireFolder | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [gameSelectOpen, setGameSelectOpen] = useState(false);
  const [gameCandidates, setGameCandidates] = useState<PgnGameSelectCandidate[]>([]);
  const [gameSelected, setGameSelected] = useState<Set<string>>(new Set());
  const [folderPickOpen, setFolderPickOpen] = useState(false);
  const [createPgn, setCreatePgn] = useState(false);
  const [createPgnFolderId, setCreatePgnFolderId] = useState<string | null>(null);
  const [createPgnNameOpen, setCreatePgnNameOpen] = useState(false);
  const [pgnPickMode, setPgnPickMode] = useState<'import' | 'edit' | null>(null);

  const whiteFolders = useMemo(
    () =>
      folders.filter(
        (f) => f.side === 'white' && !isUnfiledOpeningFolder(f) && isOpeningFolderRoot(f),
      ),
    [folders],
  );
  const blackFolders = useMemo(
    () =>
      folders.filter(
        (f) => f.side === 'black' && !isUnfiledOpeningFolder(f) && isOpeningFolderRoot(f),
      ),
    [folders],
  );
  const unassignedFolders = useMemo(
    () =>
      folders.filter(
        (f) =>
          !hasAssignedRepertoireSide(f.side) &&
          !isUnfiledOpeningFolder(f) &&
          isOpeningFolderRoot(f),
      ),
    [folders],
  );
  const unfiledFolder = useMemo(
    () => folders.find((f) => isUnfiledOpeningFolder(f)) ?? null,
    [folders],
  );

  const openCreatePgn = useCallback(() => {
    setFormError(null);
    setStatusMsg(null);
    setMoveFile(null);
    setPendingImport(null);
    setCreatePgn(true);
    setFolderPickOpen(true);
  }, []);

  const openCreate = useCallback((parent?: RepertoireFolder | null) => {
    setNameDraft('');
    setCreateParent(parent ?? null);
    setCreateSide(parent?.side ?? null);
    setFormError(null);
    setCreateOpen(true);
  }, []);

  const beginFolderPick = useCallback((pending: PendingImport) => {
    setPendingImport(pending);
    setGameSelectOpen(false);
    setFolderPickOpen(true);
  }, []);

  const clearImportFlow = useCallback(() => {
    setPendingImport(null);
    setGameSelectOpen(false);
    setFolderPickOpen(false);
    setGameCandidates([]);
    setGameSelected(new Set());
    setPgnPickMode(null);
  }, []);

  const displayNameFromFilename = (filename: string) =>
    filename.replace(/\.pgn$/i, '').trim() || filename;

  const launchExternalEditor = useCallback(
    (
      filename: string,
      sourceText: string,
      entries: PgnGameIndexEntry[],
      selectedIndices: number[],
    ) => {
      const items = selectedPgnImports(sourceText, entries, selectedIndices, filename);
      const item = items[0];
      if (!item) return;
      parkExternalOpeningPgn({
        pgnText: item.pgnText,
        displayName: item.displayName || displayNameFromFilename(filename),
      });
      clearImportFlow();
      router.push('/openings/annotate?external=1' as Href);
    },
    [clearImportFlow, router],
  );

  const pickOpeningPgn = useCallback(
    async (mode: 'import' | 'edit') => {
      setFormError(null);
      setStatusMsg(null);
      setMoveFile(null);
      setCreatePgn(false);
      setPgnPickMode(mode);
      try {
        const picked = await pickPgnFile();
        if (!picked) {
          setPgnPickMode(null);
          return;
        }
        const indexed = indexPgnGamesLight(picked.text);
        if (indexed.entries.length === 0) {
          setStatusMsg(t('openings.noValidPositions'));
          setPgnPickMode(null);
          return;
        }
        if (indexed.entries.length === 1) {
          if (mode === 'edit') {
            launchExternalEditor(
              picked.filename,
              picked.text,
              indexed.entries,
              [indexed.entries[0]!.index],
            );
            return;
          }
          beginFolderPick({
            filename: picked.filename,
            sourceText: picked.text,
            entries: indexed.entries,
            selectedIndices: [indexed.entries[0]!.index],
          });
          return;
        }
        const candidates: PgnGameSelectCandidate[] = indexed.entries.map((e) => ({
          ...e,
          id: `g-${e.index}`,
          sourceLabel: picked.filename,
        }));
        setPendingImport({
          filename: picked.filename,
          sourceText: picked.text,
          entries: indexed.entries,
          selectedIndices: [],
        });
        setGameCandidates(candidates);
        setGameSelected(new Set());
        setGameSelectOpen(true);
      } catch {
        setStatusMsg(t('openings.fileReadError'));
        setPgnPickMode(null);
      }
    },
    [beginFolderPick, launchExternalEditor, t],
  );

  const openImport = useCallback(() => {
    router.push('/openings/import' as Href);
  }, [router]);

  const openEditPgn = useCallback(() => {
    void pickOpeningPgn('edit');
  }, [pickOpeningPgn]);

  const confirmGameSelect = useCallback(() => {
    if (!pendingImport) return;
    const indices = [...gameSelected]
      .map((id) => Number(id.replace(/^g-/, '')))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    if (indices.length === 0) return;
    if (pgnPickMode === 'edit') {
      launchExternalEditor(
        pendingImport.filename,
        pendingImport.sourceText,
        pendingImport.entries,
        [indices[0]!],
      );
      return;
    }
    beginFolderPick({
      ...pendingImport,
      selectedIndices: indices,
    });
  }, [beginFolderPick, gameSelected, launchExternalEditor, pendingImport, pgnPickMode]);

  const importIntoFolder = useCallback(
    async (folderId: string) => {
      if (!pendingImport) return;
      setBusy(true);
      setFormError(null);
      try {
        const imports = selectedPgnImports(
          pendingImport.sourceText,
          pendingImport.entries,
          pendingImport.selectedIndices,
          pendingImport.filename,
        );
        for (const item of imports) {
          await importPgn(folderId, item.filename, item.pgnText, item.displayName);
        }
        clearImportFlow();
        expandFolders([folderId]);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [clearImportFlow, expandFolders, importPgn, pendingImport],
  );

  const submitCreate = useCallback(async () => {
    const side = createParent && hasAssignedRepertoireSide(createParent.side)
      ? createParent.side
      : createSide;
    if (!side) {
      setFormError(t('openings.sideRequired'));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const folder = await createFolder(nameDraft, side, true, createParent?.id ?? null);
      setCreateOpen(false);
      setCreateParent(null);
      if (pendingImport) {
        await importIntoFolder(folder.id);
        return;
      }
      if (createPgn) {
        setCreatePgnFolderId(folder.id);
        setCreatePgn(false);
        setNameDraft(t('openings.newStudyDefault'));
        setCreatePgnNameOpen(true);
        return;
      }
      expandFolders([folder.id, ...(createParent ? [createParent.id] : [])]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [createFolder, createParent, createPgn, createSide, expandFolders, importIntoFolder, nameDraft, pendingImport, t]);

  const submitRenameFolder = useCallback(async () => {
    if (!renameTarget) return;
    setBusy(true);
    setFormError(null);
    try {
      await renameFolder(renameTarget.id, nameDraft);
      setRenameTarget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [nameDraft, renameFolder, renameTarget]);

  const submitRenameFile = useCallback(async () => {
    if (!renameFile) return;
    setBusy(true);
    setFormError(null);
    try {
      await renamePgnDisplayName(renameFile.id, nameDraft);
      setRenameFile(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [nameDraft, renameFile, renamePgnDisplayName]);

  const applyMove = useCallback(
    async (file: StoredPgnFile, targetFolderId: string) => {
      setBusy(true);
      try {
        await movePgn(file.id, targetFolderId);
        setMoveFile(null);
        setFolderPickOpen(false);
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [movePgn],
  );

  const applyMoveMany = useCallback(
    async (fileIds: string[], targetFolderId: string) => {
      setBusy(true);
      try {
        await movePgns(fileIds, targetFolderId);
        setMoveFile(null);
        setMoveFileIds(null);
        setSelecting(false);
        setSelectedFileIds(new Set());
        setFolderPickOpen(false);
        expandFolders([targetFolderId]);
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [expandFolders, movePgns],
  );

  const confirmSideChange = useCallback(
    (from: RepertoireFolder | null, to: RepertoireFolder | null, run: () => void) => {
      if (!needsOppositeSideMoveConfirm(from, to)) {
        run();
        return;
      }
      confirmAction(
        t('openings.changeSideConfirmTitle'),
        t('openings.changeSideConfirmBody', {
          from: from?.side ? sideLabel(from.side) : '',
          to: to?.side ? sideLabel(to.side) : '',
        }),
        run,
      );
    },
    [t],
  );

  const onPickMoveFolder = useCallback(
    (targetFolderId: string) => {
      const ids = moveFileIds ?? (moveFile ? [moveFile.id] : []);
      if (ids.length === 0) return;
      const library = getAllFiles();
      const to = folders.find((folder) => folder.id === targetFolderId) ?? null;
      const changesSide = ids.some((id) => {
        const file = library.find((item) => item.id === id);
        const from = folders.find((folder) => folder.id === file?.folderId) ?? null;
        return needsOppositeSideMoveConfirm(from, to);
      });
      const run = () => {
        if (ids.length === 1 && moveFile && !moveFileIds) void applyMove(moveFile, targetFolderId);
        else void applyMoveMany(ids, targetFolderId);
      };
      if (!changesSide) {
        run();
        return;
      }
      const sample = library.find((item) => ids.includes(item.id));
      const from = folders.find((folder) => folder.id === sample?.folderId) ?? null;
      confirmSideChange(from, to, run);
    },
    [applyMove, applyMoveMany, confirmSideChange, folders, getAllFiles, moveFile, moveFileIds],
  );

  const applyFolderMove = useCallback(
    async (parentId: string | null, side?: RepertoireSide) => {
      if (!moveFolderTarget) return;
      setBusy(true);
      try {
        await moveFolder(moveFolderTarget.id, parentId, side);
        setMoveFolderTarget(null);
        setFolderPickOpen(false);
        if (parentId) expandFolders([parentId]);
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [expandFolders, moveFolder, moveFolderTarget],
  );

  const askDeleteFolder = useCallback(
    (folder: RepertoireFolder) => {
      const children = listChildFolders(folders, folder.id);
      const contained = getFiles(folder.id);
      if (children.length === 0 && contained.length === 0) {
        confirmAction(
          t('openings.deleteFolderTitle'),
          t('openings.deleteEmptyFolderBody', { name: folder.name }),
          () => {
            void deleteFolder(folder.id);
          },
          { destructive: true, confirmLabel: t('openings.delete') },
        );
        return;
      }
      const parent = folder.parentId
        ? folders.find((item) => item.id === folder.parentId) ?? null
        : null;
      const parentName = parent
        ? isUnfiledOpeningFolder(parent)
          ? t('openings.toClassify')
          : parent.name
        : '';
      confirmAction(
        t('openings.deleteFolderTitle'),
        parent
          ? t('openings.deleteFolderKeepBody', { name: folder.name, parent: parentName })
          : t('openings.deleteFolderKeepRootBody', { name: folder.name }),
        () => {
          void deleteFolder(folder.id, { relocateContents: true });
        },
        { confirmLabel: t('openings.keepContents') },
      );
    },
    [deleteFolder, folders, getFiles, t],
  );

  const treeProps = {
    folders,
    files: getAllFiles(),
    expanded,
    onToggle: toggleExpanded,
    selecting,
    selectedFileIds,
    onToggleSelected: (fileId: string) => {
      setSelectedFileIds((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
      });
    },
    onCreateSubfolder: (folder: RepertoireFolder) => openCreate(folder),
    onRenameFolder: (folder: RepertoireFolder) => {
      setRenameTarget(folder);
      setNameDraft(folder.name);
      setFormError(null);
    },
    onMoveFolder: (folder: RepertoireFolder) => {
      setMoveFile(null);
      setMoveFileIds(null);
      setCreatePgn(false);
      setPendingImport(null);
      setMoveFolderTarget(folder);
      setFolderPickOpen(true);
    },
    onDeleteFolder: askDeleteFolder,
    onSetSide: (folderId: string, side: RepertoireSide) => {
      void setFolderSide(folderId, side);
    },
    onSetFolderEnabled: (folderId: string, enabled: boolean) => {
      void setFolderEnabled(folderId, enabled);
    },
    onSetFileEnabled: (fileId: string, enabled: boolean) => {
      void setFileEnabled(fileId, enabled);
    },
    onRenameFile: (file: StoredPgnFile) => {
      setRenameFile(file);
      setNameDraft(pgnFileDisplayName(file));
      setFormError(null);
    },
    onMoveFile: (file: StoredPgnFile) => {
      setMoveFolderTarget(null);
      setMoveFileIds(null);
      setMoveFile(file);
      setCreatePgn(false);
      setFolderPickOpen(true);
    },
    onDeleteFile: (file: StoredPgnFile) => {
      confirmAction(
        t('openings.deleteFileTitle'),
        t('openings.deleteFileBody', { name: pgnFileDisplayName(file) }),
        () => {
          void deletePgn(file.id);
        },
        { destructive: true, confirmLabel: t('openings.delete') },
      );
    },
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: contentTop,
          paddingBottom: contentBottom,
        },
      ]}
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={t('openings.manageTitle')}
        titleNumberOfLines={2}
      />

      {statusMsg ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>{statusMsg}</Text>
      ) : null}

      <View style={styles.pgnActionRow} testID="opening-pgn-actions">
        <Pressable
          testID="create-pgn-btn"
          accessibilityRole="button"
          accessibilityLabel={t('openings.createOpeningPgn')}
          onPress={openCreatePgn}
          style={({ pressed }) => [
            styles.compactAction,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={[styles.compactActionLabel, { color: colors.foreground }]}>
            {t('openings.create')}
          </Text>
        </Pressable>
        <Pressable
          testID="edit-pgn-root-btn"
          accessibilityRole="button"
          accessibilityLabel={t('openings.editOpeningPgn')}
          onPress={openEditPgn}
          style={({ pressed }) => [
            styles.compactAction,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="create-outline" size={20} color={colors.primary} />
          <Text style={[styles.compactActionLabel, { color: colors.foreground }]}>
            {t('openings.edit')}
          </Text>
        </Pressable>
        <Pressable
          testID="import-pgn-root-btn"
          accessibilityRole="button"
          accessibilityLabel={t('openings.importOpeningPgn')}
          onPress={openImport}
          style={({ pressed }) => [
            styles.compactAction,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-up-outline" size={20} color={colors.primary} />
          <Text style={[styles.compactActionLabel, { color: colors.foreground }]}>
            {t('openings.import')}
          </Text>
        </Pressable>
      </View>

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.destructive }}>{error}</Text>
        </View>
      ) : (
        <View style={styles.treePane}>
        <View style={styles.selectRow}>
          <Pressable
            testID="select-studies-btn"
            accessibilityRole="button"
            onPress={() => {
              setSelecting((value) => !value);
              setSelectedFileIds(new Set());
            }}
            style={({ pressed }) => [
              styles.selectBtn,
              { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.compactActionLabel, { color: colors.foreground }]}>
              {selecting ? t('openings.cancelSelection') : t('openings.selectStudies')}
            </Text>
          </Pressable>
          {selecting && selectedFileIds.size > 0 ? (
            <Pressable
              testID="move-selection-btn"
              accessibilityRole="button"
              onPress={() => {
                setMoveFile(null);
                setMoveFolderTarget(null);
                setCreatePgn(false);
                setMoveFileIds([...selectedFileIds]);
                setFolderPickOpen(true);
              }}
              style={({ pressed }) => [
                styles.selectBtn,
                { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.compactActionLabel, { color: colors.primaryForeground }]}>
                {t('openings.moveSelection', { count: selectedFileIds.size })}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {whiteFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionWhite')}
              </Text>
              <ManageOpeningTree roots={whiteFolders} {...treeProps} />
            </View>
          )}
          {blackFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionBlack')}
              </Text>
              <ManageOpeningTree roots={blackFolders} {...treeProps} />
            </View>
          )}
          {unfiledFolder ? (
            <View style={styles.section} testID="openings-unfiled-section">
              <ManageOpeningTree roots={[unfiledFolder]} {...treeProps} />
            </View>
          ) : null}
          {unassignedFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionUnassigned')}
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {t('openings.sectionUnassignedHint')}
              </Text>
              <ManageOpeningTree roots={unassignedFolders} {...treeProps} />
            </View>
          )}
        </ScrollView>
        </View>
      )}

      <LibraryFolderFab
        label={t('openings.createFolderFab')}
        accessibilityLabel={t('openings.createFolderA11y')}
        onPress={() => openCreate(null)}
        testID="create-folder-btn"
      />

      <NameModal
        visible={createOpen}
        title={createParent ? t('openings.createSubfolder') : t('openings.newRepertoire')}
        placeholder={t('openings.namePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => {
          setCreateOpen(false);
          if (pendingImport || createPgn) setFolderPickOpen(true);
        }}
        onSubmit={() => {
          void submitCreate();
        }}
        busy={busy}
        error={formError}
        submitLabel={t('openings.create')}
      >
        {createParent && hasAssignedRepertoireSide(createParent.side) ? null : (
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
              {t('openings.setSide')}
            </Text>
            <RepertoireSidePicker value={createSide} onChange={setCreateSide} />
          </View>
        )}
      </NameModal>

      <NameModal
        visible={renameTarget != null}
        title={t('openings.renameRepertoire')}
        placeholder={t('openings.renamePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setRenameTarget(null)}
        onSubmit={() => {
          void submitRenameFolder();
        }}
        busy={busy}
        error={formError}
        submitLabel={t('common.save')}
      />
      <NameModal
        visible={createPgnNameOpen}
        title={t('openings.newPgnName')}
        placeholder={t('openings.newPgnNamePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => {
          setCreatePgnNameOpen(false);
          setCreatePgnFolderId(null);
        }}
        onSubmit={() => {
          if (!createPgnFolderId) return;
          const title = nameDraft.trim() || t('openings.newStudyDefault');
          const folderId = createPgnFolderId;
          setCreatePgnNameOpen(false);
          setCreatePgnFolderId(null);
          router.push(
            `/openings/annotate?folderId=${encodeURIComponent(folderId)}&name=${encodeURIComponent(title)}` as Href,
          );
        }}
        busy={busy}
        error={formError}
        submitLabel={t('openings.annotatePgn')}
      />
      <NameModal
        visible={renameFile != null}
        title={t('openings.renameDisplayName')}
        placeholder={t('openings.renameDisplayPlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setRenameFile(null)}
        onSubmit={() => {
          void submitRenameFile();
        }}
        busy={busy}
        error={formError}
        submitLabel={t('common.save')}
      />

      <PgnGameSelectModal
        visible={gameSelectOpen}
        candidates={gameCandidates}
        selected={gameSelected}
        onChangeSelected={(next) => setGameSelected(next)}
        onCancel={clearImportFlow}
        onConfirm={confirmGameSelect}
        maxSelection={pgnPickMode === 'edit' ? 1 : MAX_OPENINGS_PGN_IMPORT_BATCH}
        confirmLabel={pgnPickMode === 'edit' ? t('openings.editOpeningPgn') : t('openings.import')}
      />

      <FolderPickModal
        visible={folderPickOpen}
        folders={folders}
        busy={busy}
        title={moveFolderTarget || moveFile || moveFileIds ? t('openings.moveToTitle') : undefined}
        excludeFolderId={moveFileIds ? null : moveFile?.folderId}
        movingFolderId={moveFolderTarget?.id ?? null}
        showRootTargets={moveFolderTarget != null}
        onSelectRoot={(side) => {
          if (!moveFolderTarget) return;
          const synthetic = { ...moveFolderTarget, side };
          confirmSideChange(moveFolderTarget, synthetic, () => {
            void applyFolderMove(null, side);
          });
        }}
        onSelect={(folderId) => {
          if (moveFolderTarget) {
            const target = folders.find((folder) => folder.id === folderId) ?? null;
            confirmSideChange(moveFolderTarget, target, () => {
              void applyFolderMove(folderId);
            });
            return;
          }
          if (moveFile || moveFileIds) onPickMoveFolder(folderId);
          else if (createPgn) {
            setCreatePgnFolderId(folderId);
            setCreatePgn(false);
            setFolderPickOpen(false);
            setNameDraft(t('openings.newStudyDefault'));
            setCreatePgnNameOpen(true);
          } else void importIntoFolder(folderId);
        }}
        onCreateFolder={() => {
          setFolderPickOpen(false);
          openCreate(null);
        }}
        onCancel={() => {
          if (moveFile || moveFileIds || moveFolderTarget) {
            setMoveFile(null);
            setMoveFileIds(null);
            setMoveFolderTarget(null);
            setFolderPickOpen(false);
            return;
          }
          if (createPgn) {
            setCreatePgn(false);
            setFolderPickOpen(false);
            return;
          }
          clearImportFlow();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  pgnActionRow: { flexDirection: 'row', gap: 8 },
  compactAction: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  compactActionLabel: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  pgnActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  pgnActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pgnActionLabel: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  treePane: { flex: 1, gap: 8 },
  list: { gap: 16, paddingBottom: 140 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  folderCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  compactFolderHeader: { minHeight: 48 },
  compactFolderName: { flex: 1, flexShrink: 1 },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderBody: { flex: 1, gap: 2 },
  folderName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  folderTools: { gap: 8 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pgnList: { gap: 8 },
  pgnRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  pgnTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pgnMain: { flex: 1, gap: 2 },
  pgnName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pgnActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  selectRow: { flexDirection: 'row', gap: 8 },
  selectBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  status: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  folderFab: {
    position: 'absolute',
    right: DesignTokens.spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 20,
  },
  folderFabLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
