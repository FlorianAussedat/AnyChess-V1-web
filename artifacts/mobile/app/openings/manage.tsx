import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import {
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
import { confirmAction } from '@/lib/openings/confirmAction';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NameModal } from '@/components/openings/NameModal';
import { FolderPickModal } from '@/components/openings/FolderPickModal';
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
    importPgn,
    deletePgn,
    renamePgnDisplayName,
    movePgn,
    setFolderSide,
    setFolderEnabled,
    setFileEnabled,
  } = useRepertoireLibrary();

  const [createOpen, setCreateOpen] = useState(false);
  const [createSide, setCreateSide] = useState<RepertoireSide | null>(null);
  const [renameTarget, setRenameTarget] = useState<RepertoireFolder | null>(null);
  const [renameFile, setRenameFile] = useState<StoredPgnFile | null>(null);
  const [moveFile, setMoveFile] = useState<StoredPgnFile | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [gameSelectOpen, setGameSelectOpen] = useState(false);
  const [gameCandidates, setGameCandidates] = useState<PgnGameSelectCandidate[]>([]);
  const [gameSelected, setGameSelected] = useState<Set<string>>(new Set());
  const [folderPickOpen, setFolderPickOpen] = useState(false);

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

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openCreate = useCallback(() => {
    setNameDraft('');
    setCreateSide(null);
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
        setExpanded((prev) => new Set(prev).add(folderId));
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [clearImportFlow, importPgn, pendingImport],
  );

  const submitCreate = useCallback(async () => {
    if (!createSide) {
      setFormError(t('openings.sideRequired'));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const folder = await createFolder(nameDraft, createSide, true);
      setCreateOpen(false);
      if (pendingImport) {
        await importIntoFolder(folder.id);
        return;
      }
      setExpanded((prev) => new Set(prev).add(folder.id));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [createFolder, createSide, importIntoFolder, nameDraft, pendingImport, t]);

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

  const onPickMoveFolder = useCallback(
    (targetFolderId: string) => {
      if (!moveFile) return;
      const from = folders.find((f) => f.id === moveFile.folderId) ?? null;
      const to = folders.find((f) => f.id === targetFolderId) ?? null;
      if (needsOppositeSideMoveConfirm(from, to)) {
        confirmAction(
          t('openings.changeSideConfirmTitle'),
          t('openings.changeSideConfirmBody', {
            from: from?.side ? sideLabel(from.side) : '',
            to: to?.side ? sideLabel(to.side) : '',
          }),
          () => {
            void applyMove(moveFile, targetFolderId);
          },
        );
        return;
      }
      void applyMove(moveFile, targetFolderId);
    },
    [applyMove, folders, moveFile, t],
  );

  const renderPgn = (file: StoredPgnFile, folder: RepertoireFolder) => {
    const active = folder.enabled !== false && file.enabled !== false;
    const name = pgnFileDisplayName(file);
    return (
      <View
        key={file.id}
        style={[styles.pgnRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        testID={`manage-pgn-${file.id}`}
      >
        <View style={styles.pgnMain}>
          <Text style={[styles.pgnName, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {active ? t('openings.folderActive') : t('openings.folderInactive')}
            {' · '}
            {t('openings.linesShort', { count: file.summary.branchCount })}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/openings/study?fileId=${encodeURIComponent(file.id)}` as Href)}
          hitSlop={8}
          testID={`view-pgn-${file.id}`}
          accessibilityLabel={t('openings.viewPgn')}
        >
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
        </Pressable>
        <Switch
          value={file.enabled !== false}
          onValueChange={(v) => {
            void setFileEnabled(file.id, v);
          }}
          testID={`toggle-pgn-${file.id}`}
        />
        <Pressable
          onPress={() => {
            setRenameFile(file);
            setNameDraft(name);
            setFormError(null);
          }}
          hitSlop={8}
          testID={`rename-pgn-${file.id}`}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => {
            setMoveFile(file);
            setFolderPickOpen(true);
          }}
          hitSlop={8}
          testID={`move-pgn-${file.id}`}
        >
          <Ionicons name="folder-outline" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() =>
            confirmAction(
              t('openings.deleteFileTitle'),
              t('openings.deleteFileBody', { name }),
              () => {
                void deletePgn(file.id);
              },
              { destructive: true, confirmLabel: t('openings.delete') },
            )
          }
          hitSlop={8}
          testID={`delete-pgn-${file.id}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
        </Pressable>
      </View>
    );
  };

  const renderFolder = (folder: RepertoireFolder) => {
    const files = getFiles(folder.id);
    const open = expanded.has(folder.id);
    const lines = files.reduce((sum, f) => sum + (f.summary.branchCount || 0), 0);
    const folderOn = folder.enabled !== false;
    return (
      <View
        key={folder.id}
        style={[styles.folderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID={`manage-folder-${folder.id}`}
      >
        <Pressable onPress={() => toggleExpanded(folder.id)} style={styles.folderHeader}>
          <View style={[styles.folderIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="folder" size={20} color={colors.primaryForeground} />
          </View>
          <View style={styles.folderBody}>
            <Text style={[styles.folderName, { color: colors.foreground }]}>{folder.name}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {folder.side ? sideLabel(folder.side) : t('openings.setSide')}
              {' · '}
              {folderOn ? t('openings.folderActive') : t('openings.folderInactive')}
              {' · '}
              {t('openings.pgnFileCount', { count: files.length })}
              {lines > 0 ? ` · ${t('openings.linesShort', { count: lines })}` : ''}
            </Text>
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>

        {!folder.side ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t('openings.unassignedSideHint')}
          </Text>
        ) : null}

        <View style={styles.folderTools}>
          <RepertoireSidePicker
            value={folder.side ?? null}
            onChange={(side) => {
              void setFolderSide(folder.id, side);
            }}
          />
          <View style={styles.toolRow}>
            <Text style={[styles.meta, { color: colors.foreground }]}>
              {t('openings.toggleReview')}
            </Text>
            <Switch
              value={folderOn}
              onValueChange={(v) => {
                void setFolderEnabled(folder.id, v);
              }}
              testID={`toggle-folder-${folder.id}`}
            />
            <Pressable
              onPress={() => {
                setRenameTarget(folder);
                setNameDraft(folder.name);
                setFormError(null);
              }}
              hitSlop={8}
              testID={`rename-folder-${folder.id}`}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() =>
                confirmAction(
                  t('openings.deleteFolderTitle'),
                  t('openings.deleteFolderBody', { name: folder.name }),
                  () => {
                    void deleteFolder(folder.id);
                  },
                  { destructive: true, confirmLabel: t('profil.erase') },
                )
              }
              hitSlop={8}
              testID={`delete-folder-${folder.id}`}
            >
              <Ionicons name="trash-outline" size={18} color={colors.destructive} />
            </Pressable>
          </View>
        </View>

        {open ? <View style={styles.pgnList}>{files.map((f) => renderPgn(f, folder))}</View> : null}
      </View>
    );
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
        subtitle={t('openings.managePgn')}
        trailing={
          <View style={styles.headerActions}>
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
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>
                {t('openings.importPgn')}
              </Text>
            </Pressable>
            <Pressable
              onPress={openCreate}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
              ]}
              testID="create-folder-btn"
            >
              <Ionicons name="add" size={18} color={colors.primaryForeground} />
              <Text style={[styles.btnLabel, { color: colors.primaryForeground }]}>
                {t('openings.new')}
              </Text>
            </Pressable>
          </View>
        }
      />

      {statusMsg ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>{statusMsg}</Text>
      ) : null}

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.destructive }}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {whiteFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionWhite')}
              </Text>
              {whiteFolders.map(renderFolder)}
            </View>
          )}
          {blackFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionBlack')}
              </Text>
              {blackFolders.map(renderFolder)}
            </View>
          )}
          {unassignedFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {t('openings.sectionUnassigned')}
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {t('openings.sectionUnassignedHint')}
              </Text>
              {unassignedFolders.map(renderFolder)}
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
          if (pendingImport) setFolderPickOpen(true);
        }}
        onSubmit={() => {
          void submitCreate();
        }}
        busy={busy}
        error={formError}
        submitLabel={t('openings.create')}
      >
        <View style={{ gap: 8, marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            {t('openings.setSide')}
          </Text>
          <RepertoireSidePicker value={createSide} onChange={setCreateSide} />
        </View>
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
        maxSelection={MAX_OPENINGS_PGN_IMPORT_BATCH}
        confirmLabel={t('openings.import')}
      />

      <FolderPickModal
        visible={folderPickOpen}
        folders={folders}
        busy={busy}
        excludeFolderId={moveFile?.folderId}
        onSelect={(folderId) => {
          if (moveFile) onPickMoveFolder(folderId);
          else void importIntoFolder(folderId);
        }}
        onCreateFolder={() => {
          setFolderPickOpen(false);
          openCreate();
        }}
        onCancel={() => {
          if (moveFile) {
            setMoveFile(null);
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
  btnLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  list: { gap: 16, paddingBottom: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  folderCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  pgnMain: { flex: 1, gap: 2 },
  pgnName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  status: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
