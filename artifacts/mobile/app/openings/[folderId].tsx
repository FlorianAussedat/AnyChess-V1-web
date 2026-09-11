import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import {
  joinSelectedPgnSlices,
  pgnFileDisplayName,
  type StoredPgnFile,
  type RepertoireSide,
} from '@/lib/repertoire';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import {
  indexPgnGamesLight,
  MAX_OPENINGS_PGN_IMPORT_BATCH,
  type PgnGameIndexEntry,
} from '@/lib/gameLibrary';
import { displayNameFromFilename } from '@/lib/gameLibrary/displayNameFromFilename';
import { sideLabel } from '@/components/RepertoireSidePicker';
import type { PlayerColor } from '@/contexts/GameContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HubModeCard } from '@/components/HubModeCard';
import { PgnFileRow } from '@/components/openings/PgnFileRow';
import { NameModal } from '@/components/openings/NameModal';
import { FolderPickModal } from '@/components/openings/FolderPickModal';
import { PlayOpeningModal } from '@/components/openings/PlayOpeningModal';
import { preferencesStore } from '@/lib/preferences';
import { getStrengthBand } from '@/lib/difficulty/StockfishStrengthBands';
import { SideMigrationModal } from '@/components/openings/SideMigrationModal';
import { PgnFileDetailModal } from '@/components/openings/PgnFileDetailModal';
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

export default function FolderDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();

  const {
    ready,
    folders,
    getFolder,
    getFiles,
    importPgn,
    deletePgn,
    renamePgnDisplayName,
    movePgn,
    setFolderSide,
    setFileEnabled,
    createFolder,
  } = useRepertoireLibrary();

  const folder = folderId ? getFolder(folderId) : null;
  const files = useMemo(
    () => (folderId ? getFiles(folderId) : []),
    [folderId, getFiles],
  );

  const totalGames = useMemo(
    () => files.reduce((sum, f) => sum + (f.summary.gameCount || 0), 0),
    [files],
  );
  const totalLines = useMemo(
    () => files.reduce((sum, f) => sum + (f.summary.branchCount || 0), 0),
    [files],
  );

  const [detailFile, setDetailFile] = useState<StoredPgnFile | null>(null);
  const [playOpen, setPlayOpen] = useState(false);
  const [sideMigrationOpen, setSideMigrationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'play' | 'continue' | null>(null);
  const [migrationSide, setMigrationSide] = useState<RepertoireSide | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [gameSelectOpen, setGameSelectOpen] = useState(false);
  const [gameCandidates, setGameCandidates] = useState<PgnGameSelectCandidate[]>([]);
  const [gameSelected, setGameSelected] = useState<Set<string>>(new Set());

  const [renameFile, setRenameFile] = useState<StoredPgnFile | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [moveFile, setMoveFile] = useState<StoredPgnFile | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const canPlay = files.some((f) => f.summary.parseSucceeded);

  const ensureSideThen = useCallback(
    (action: 'play' | 'continue') => {
      if (!folderId || !canPlay) return;
      if (folder?.side) {
        if (action === 'play') setPlayOpen(true);
        else {
          router.push(`/openings/continue?folderId=${encodeURIComponent(folderId)}` as Href);
        }
        return;
      }
      setMigrationSide(null);
      setPendingAction(action);
      setSideMigrationOpen(true);
    },
    [folderId, canPlay, folder?.side, router],
  );

  const saveMigrationSide = useCallback(async () => {
    if (!folderId || !migrationSide) return;
    setBusy(true);
    try {
      await setFolderSide(folderId, migrationSide);
      setSideMigrationOpen(false);
      const action = pendingAction;
      setPendingAction(null);
      if (action === 'play') setPlayOpen(true);
      else if (action === 'continue') {
        router.push(`/openings/continue?folderId=${encodeURIComponent(folderId)}` as Href);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [folderId, migrationSide, pendingAction, setFolderSide, router]);

  const startPlay = useCallback(
    (strengthBandId: string) => {
      if (!folderId || !canPlay || !folder?.side) return;
      const normalized = getStrengthBand(strengthBandId).id;
      void preferencesStore.update({ stockfishStrengthBandId: normalized });
      setPlayOpen(false);
      const color: PlayerColor = folder.side === 'white' ? 'w' : 'b';
      router.push(
        `/openings/play?folderId=${encodeURIComponent(folderId)}&color=${color}&band=${encodeURIComponent(normalized)}` as Href,
      );
    },
    [folderId, canPlay, folder?.side, router],
  );

  const clearImportSelect = useCallback(() => {
    setPendingImport(null);
    setGameSelectOpen(false);
    setGameCandidates([]);
    setGameSelected(new Set());
  }, []);

  const runImport = useCallback(
    async (pending: PendingImport) => {
      if (!folderId) return;
      setBusy(true);
      setFormError(null);
      try {
        const pgnText = joinSelectedPgnSlices(
          pending.sourceText,
          pending.entries,
          pending.selectedIndices,
        );
        if (!pgnText.trim()) {
          setStatusMsg(t('openings.noValidPositions'));
          clearImportSelect();
          return;
        }
        const displayName = displayNameFromFilename(pending.filename);
        await importPgn(folderId, pending.filename, pgnText, displayName);
        clearImportSelect();
        setStatusMsg(null);
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [clearImportSelect, folderId, importPgn, t],
  );

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
        await runImport({
          filename: picked.filename,
          sourceText: picked.text,
          entries: indexed.entries,
          selectedIndices: [indexed.entries[0]!.index],
        });
        return;
      }
      setPendingImport({
        filename: picked.filename,
        sourceText: picked.text,
        entries: indexed.entries,
        selectedIndices: [],
      });
      setGameCandidates(
        indexed.entries.map((e) => ({
          ...e,
          id: `g-${e.index}`,
          sourceLabel: picked.filename,
        })),
      );
      setGameSelected(new Set());
      setGameSelectOpen(true);
    } catch {
      setStatusMsg(t('openings.fileReadError'));
    }
  }, [runImport, t]);

  const confirmGameSelect = useCallback(() => {
    if (!pendingImport) return;
    const indices = [...gameSelected]
      .map((id) => Number(id.replace(/^g-/, '')))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    if (indices.length === 0) return;
    void runImport({
      ...pendingImport,
      selectedIndices: indices,
    });
  }, [gameSelected, pendingImport, runImport]);

  const confirmDeleteFile = useCallback(
    (file: StoredPgnFile) => {
      const name = pgnFileDisplayName(file);
      const message = t('openings.removeFileBody', { name });
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(message)) {
          deletePgn(file.id).catch(() => {});
        }
        return;
      }
      Alert.alert(t('openings.removeFileTitle'), message, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profil.erase'),
          style: 'destructive',
          onPress: () => {
            deletePgn(file.id).catch(() => {});
          },
        },
      ]);
    },
    [deletePgn, t],
  );

  const openRenameFile = useCallback((file: StoredPgnFile) => {
    setRenameFile(file);
    setNameDraft(pgnFileDisplayName(file));
    setFormError(null);
  }, []);

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

  const openMoveFile = useCallback((file: StoredPgnFile) => {
    setMoveFile(file);
  }, []);

  const submitMoveFile = useCallback(
    async (targetFolderId: string) => {
      if (!moveFile) return;
      setBusy(true);
      try {
        await movePgn(moveFile.id, targetFolderId);
        setMoveFile(null);
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [moveFile, movePgn],
  );

  const submitCreateForMove = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    try {
      const created = await createFolder(nameDraft);
      setCreateOpen(false);
      if (moveFile) {
        await movePgn(moveFile.id, created.id);
        setMoveFile(null);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [createFolder, moveFile, movePgn, nameDraft]);

  const onToggleEnabled = useCallback(
    (file: StoredPgnFile) => {
      const next = file.enabled === false;
      setFileEnabled(file.id, next).catch(() => {});
    },
    [setFileEnabled],
  );

  if (!ready) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!folder) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ScreenHeader onBack={() => router.back()} title={t('openings.folderMissing')} />
      </View>
    );
  }

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
        title={folder.name}
        subtitle={`${t('openings.filesCount', { count: files.length })} · ${t(
          'openings.gamesCount',
          { count: totalGames },
        )} · ${t('openings.linesCount', { count: totalLines })}${
          folder.side ? ` · ${sideLabel(folder.side)}` : ''
        }`}
        trailing={
          <Pressable
            onPress={() => {
              void openImport();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            testID="import-pgn-btn"
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.foreground} />
            <Text style={[styles.primaryBtnLabel, { color: colors.foreground }]}>
              {t('openings.import')}
            </Text>
          </Pressable>
        }
      />

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        {t('openings.folderHint')}
      </Text>

      {statusMsg ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>{statusMsg}</Text>
      ) : null}

      <View style={styles.exerciseBlock}>
        <Text style={[styles.exerciseHeading, { color: colors.foreground }]}>
          {t('openings.exercises')}
        </Text>
        <HubModeCard
          title={t('openings.playVsRepertoire')}
          description={t('openings.playVsDesc')}
          iconName="play-circle-outline"
          onPress={() => ensureSideThen('play')}
          disabled={!canPlay}
          testID="play-opening-btn"
        />
        <HubModeCard
          title={t('openings.continueLine')}
          description={t('openings.continueLineDesc')}
          iconName="mic-outline"
          onPress={() => ensureSideThen('continue')}
          disabled={!canPlay}
          testID="continue-line-btn"
        />
        <Text style={[styles.exerciseHeading, { color: colors.foreground, marginTop: 8 }]}>
          {t('openings.managePgn')}
        </Text>
      </View>

      {files.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-outline" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t('errors.noPgn')}
          </Text>
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            {t('openings.emptyPgnBody')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PgnFileRow
              file={item}
              onOpenDetail={setDetailFile}
              onToggleEnabled={onToggleEnabled}
              onRename={openRenameFile}
              onMove={openMoveFile}
              onDelete={confirmDeleteFile}
            />
          )}
        />
      )}

      <PgnGameSelectModal
        visible={gameSelectOpen}
        candidates={gameCandidates}
        selected={gameSelected}
        onChangeSelected={(next) => setGameSelected(next)}
        onCancel={clearImportSelect}
        onConfirm={confirmGameSelect}
        maxSelection={MAX_OPENINGS_PGN_IMPORT_BATCH}
        confirmLabel={t('openings.import')}
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

      <FolderPickModal
        visible={moveFile != null && !createOpen}
        folders={folders}
        excludeFolderId={folderId}
        busy={busy}
        title={t('openings.moveToFolder')}
        onSelect={(id) => {
          void submitMoveFile(id);
        }}
        onCreateFolder={() => {
          setNameDraft('');
          setFormError(null);
          setCreateOpen(true);
        }}
        onCancel={() => setMoveFile(null)}
      />

      <NameModal
        visible={createOpen}
        title={t('openings.newRepertoire')}
        placeholder={t('openings.namePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setCreateOpen(false)}
        onSubmit={() => {
          void submitCreateForMove();
        }}
        busy={busy}
        error={formError}
        submitLabel={t('openings.create')}
      />

      <PlayOpeningModal
        visible={playOpen}
        folderName={folder.name}
        folderSide={folder.side}
        initialBandId={
          preferencesStore.getPreferences().stockfishStrengthBandId
        }
        onCancel={() => setPlayOpen(false)}
        onConfirm={startPlay}
        onRequestClose={() => setPlayOpen(false)}
      />

      <SideMigrationModal
        visible={sideMigrationOpen}
        folderName={folder.name}
        migrationSide={migrationSide}
        onMigrationSideChange={setMigrationSide}
        busy={busy}
        onCancel={() => {
          setSideMigrationOpen(false);
          setPendingAction(null);
        }}
        onSave={saveMigrationSide}
        onRequestClose={() => setSideMigrationOpen(false)}
      />

      <PgnFileDetailModal file={detailFile} onClose={() => setDetailFile(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryBtnLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    paddingHorizontal: 2,
  },
  status: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 2,
  },
  exerciseBlock: {
    gap: 8,
  },
  exerciseHeading: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
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
  emptyMsg: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
});
