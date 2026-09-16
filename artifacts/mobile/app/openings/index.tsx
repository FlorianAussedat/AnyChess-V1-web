import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import type { RepertoireFolder, ReviewSideFilter } from '@/lib/repertoire';
import {
  filterFoldersByReviewSide,
  joinSelectedPgnSlices,
} from '@/lib/repertoire';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import {
  indexPgnGamesLight,
  MAX_OPENINGS_PGN_IMPORT_BATCH,
  type PgnGameIndexEntry,
} from '@/lib/gameLibrary';
import { displayNameFromFilename } from '@/lib/gameLibrary/displayNameFromFilename';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FolderListRow } from '@/components/openings/FolderListRow';
import { NameModal } from '@/components/openings/NameModal';
import { OpeningEmptyState } from '@/components/openings/OpeningEmptyState';
import { OpeningsReviewBlock } from '@/components/openings/OpeningsReviewBlock';
import { MixedTrainingModal } from '@/components/openings/MixedTrainingModal';
import { FolderPickModal } from '@/components/openings/FolderPickModal';
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

export default function OpeningsFolderList() {
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
    getTrainableFolders,
    importPgn,
  } = useRepertoireLibrary();

  const trainable = getTrainableFolders();
  const [mixedSelect, setMixedSelect] = useState<Set<string>>(new Set());
  const [mixedOpen, setMixedOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  /** After create from empty / folder-pick, navigate into the new folder. */
  const [navigateAfterCreate, setNavigateAfterCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RepertoireFolder | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [gameSelectOpen, setGameSelectOpen] = useState(false);
  const [gameCandidates, setGameCandidates] = useState<PgnGameSelectCandidate[]>([]);
  const [gameSelected, setGameSelected] = useState<Set<string>>(new Set());
  const [folderPickOpen, setFolderPickOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const whiteFolders = useMemo(
    () => folders.filter((f) => f.side === 'white'),
    [folders],
  );
  const blackFolders = useMemo(
    () => folders.filter((f) => f.side === 'black'),
    [folders],
  );
  const unassignedFolders = useMemo(
    () => folders.filter((f) => !f.side),
    [folders],
  );

  const openCreate = useCallback((navigateInto = false) => {
    setNameDraft('');
    setFormError(null);
    setNavigateAfterCreate(navigateInto);
    setCreateOpen(true);
  }, []);

  const openRename = useCallback((folder: RepertoireFolder) => {
    setRenameTarget(folder);
    setNameDraft(folder.name);
    setFormError(null);
  }, []);

  const beginFolderPick = useCallback((pending: PendingImport) => {
    setPendingImport(pending);
    setGameSelectOpen(false);
    setFolderPickOpen(true);
  }, []);

  const openImport = useCallback(async () => {
    setFormError(null);
    setStatusMsg(null);
    try {
      const picked = await pickPgnFile();
      if (!picked) return;
      const indexed = indexPgnGamesLight(picked.text);
      if (indexed.entries.length === 0) {
        setStatusMsg(t('openings.noValidPositions'));
        return;
      }
      if (indexed.entries.length === 1) {
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
    }
  }, [beginFolderPick, t]);

  const confirmGameSelect = useCallback(() => {
    if (!pendingImport) return;
    const indices = [...gameSelected]
      .map((id) => Number(id.replace(/^g-/, '')))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    if (indices.length === 0) return;
    beginFolderPick({
      ...pendingImport,
      selectedIndices: indices,
    });
  }, [beginFolderPick, gameSelected, pendingImport]);

  const clearImportFlow = useCallback(() => {
    setPendingImport(null);
    setGameSelectOpen(false);
    setFolderPickOpen(false);
    setGameCandidates([]);
    setGameSelected(new Set());
  }, []);

  const importIntoFolder = useCallback(
    async (folderId: string) => {
      if (!pendingImport) return;
      setBusy(true);
      setFormError(null);
      try {
        const pgnText = joinSelectedPgnSlices(
          pendingImport.sourceText,
          pendingImport.entries,
          pendingImport.selectedIndices,
        );
        if (!pgnText.trim()) {
          setStatusMsg(t('openings.noValidPositions'));
          clearImportFlow();
          return;
        }
        const displayName = displayNameFromFilename(pendingImport.filename);
        await importPgn(folderId, pendingImport.filename, pgnText, displayName);
        clearImportFlow();
        router.push(`/openings/${folderId}` as Href);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [clearImportFlow, importPgn, pendingImport, router, t],
  );

  const submitCreate = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    try {
      const folder = await createFolder(nameDraft);
      const shouldNavigate = navigateAfterCreate || folders.length === 0;
      setCreateOpen(false);
      setNavigateAfterCreate(false);
      // Import pending PGN into the newly created folder (never auto-unclassified).
      if (pendingImport) {
        await importIntoFolder(folder.id);
        return;
      }
      if (shouldNavigate) {
        router.push(`/openings/${folder.id}` as Href);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    createFolder,
    folders.length,
    importIntoFolder,
    nameDraft,
    navigateAfterCreate,
    pendingImport,
    router,
  ]);

  const submitRename = useCallback(async () => {
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
  }, [renameFolder, renameTarget, nameDraft]);

  const toggleMixedFolder = useCallback((folderId: string) => {
    setMixedSelect((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const selectAllTrainable = useCallback(() => {
    setMixedSelect(new Set(trainable.map((f) => f.id)));
  }, [trainable]);

  const startMixedContinue = useCallback(() => {
    const ids = [...mixedSelect];
    if (ids.length === 0) return;
    setMixedOpen(false);
    router.push(
      `/openings/continue?folderIds=${encodeURIComponent(ids.join(','))}&side=all` as Href,
    );
  }, [mixedSelect, router]);

  const startReview = useCallback(
    (side: ReviewSideFilter) => {
      const pool = filterFoldersByReviewSide(trainable, side);
      if (pool.length === 0) return;
      const ids = pool.map((f) => f.id).join(',');
      router.push(
        `/openings/continue?folderIds=${encodeURIComponent(ids)}&side=${side}` as Href,
      );
    },
    [trainable, router],
  );

  const confirmDelete = useCallback(
    (folder: RepertoireFolder) => {
      const message = t('openings.deleteFolderBody', { name: folder.name });

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(message)) {
          deleteFolder(folder.id).catch(() => {});
        }
        return;
      }

      Alert.alert(t('openings.deleteFolderTitle'), message, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profil.erase'),
          style: 'destructive',
          onPress: () => {
            deleteFolder(folder.id).catch(() => {});
          },
        },
      ]);
    },
    [deleteFolder, t],
  );

  const renderFolderRow = useCallback(
    (item: RepertoireFolder) => (
      <FolderListRow
        key={item.id}
        folder={item}
        fileCount={getFiles(item.id).length}
        onOpen={() => router.push(`/openings/${item.id}` as Href)}
        onRename={() => openRename(item)}
        onDelete={() => confirmDelete(item)}
      />
    ),
    [confirmDelete, getFiles, openRename, router],
  );

  const reviewDisabled = (side: ReviewSideFilter) =>
    filterFoldersByReviewSide(trainable, side).length === 0;

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
        title={t('openings.title')}
        subtitle={t('openings.repertoires')}
        backTestID="openings-back"
        trailing={
          <View style={styles.headerActions}>
            {folders.length > 0 ? (
              <Pressable
                onPress={() => {
                  void openImport();
                }}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                testID="import-pgn-root-btn"
              >
                <Ionicons name="cloud-upload-outline" size={16} color={colors.foreground} />
                <Text style={[styles.primaryBtnLabel, { color: colors.foreground }]}>
                  {t('openings.importPgn')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => openCreate(false)}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
              ]}
              testID="create-folder-btn"
            >
              <Ionicons name="add" size={18} color={colors.primaryForeground} />
              <Text style={[styles.primaryBtnLabel, { color: colors.primaryForeground }]}>
                {t('openings.new')}
              </Text>
            </Pressable>
          </View>
        }
      />

      {trainable.length > 0 && (
        <OpeningsReviewBlock
          reviewDisabled={reviewDisabled}
          onStartReview={startReview}
          onOpenMixed={() => {
            if (mixedSelect.size === 0) selectAllTrainable();
            setMixedOpen(true);
          }}
        />
      )}

      {statusMsg ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>{statusMsg}</Text>
      ) : null}

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : folders.length === 0 ? (
        <OpeningEmptyState onCreateFolder={() => openCreate(true)} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {whiteFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionWhite')}
              </Text>
              {whiteFolders.map(renderFolderRow)}
            </View>
          )}
          {blackFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionBlack')}
              </Text>
              {blackFolders.map(renderFolderRow)}
            </View>
          )}
          {unassignedFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionUnassigned')}
              </Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                {t('openings.sectionUnassignedHint')}
              </Text>
              {unassignedFolders.map(renderFolderRow)}
            </View>
          )}
        </ScrollView>
      )}

      <NameModal
        visible={createOpen}
        title={t('openings.newRepertoire')}
        placeholder={t('openings.namePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => {
          setCreateOpen(false);
          setNavigateAfterCreate(false);
          if (pendingImport) setFolderPickOpen(true);
        }}
        onSubmit={() => {
          void submitCreate();
        }}
        busy={busy}
        error={formError}
        submitLabel={t('openings.create')}
      />

      <NameModal
        visible={renameTarget != null}
        title={t('openings.renameRepertoire')}
        placeholder={t('openings.renamePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setRenameTarget(null)}
        onSubmit={() => {
          void submitRename();
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
        maxSelection={MAX_OPENINGS_PGN_IMPORT_BATCH}
        confirmLabel={t('openings.import')}
      />

      <FolderPickModal
        visible={folderPickOpen}
        folders={folders}
        busy={busy}
        onSelect={(folderId) => {
          void importIntoFolder(folderId);
        }}
        onCreateFolder={() => {
          // Keep pendingImport; submitCreate imports into the new folder.
          setFolderPickOpen(false);
          openCreate(false);
        }}
        onCancel={clearImportFlow}
      />

      <MixedTrainingModal
        visible={mixedOpen}
        trainable={trainable}
        mixedSelect={mixedSelect}
        onClose={() => setMixedOpen(false)}
        onSelectAll={selectAllTrainable}
        onToggleFolder={toggleMixedFolder}
        onStart={startMixedContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryBtnLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  list: { gap: 16, paddingBottom: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    marginTop: -4,
  },
  status: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
});
