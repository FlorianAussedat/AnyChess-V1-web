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
import type { RepertoireFolder, RepertoireSide, ReviewSideFilter } from '@/lib/repertoire';
import { filterFoldersByReviewSide } from '@/lib/repertoire';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FolderListRow } from '@/components/openings/FolderListRow';
import { NameModal } from '@/components/openings/NameModal';
import { OpeningEmptyState } from '@/components/openings/OpeningEmptyState';
import { OpeningsReviewBlock } from '@/components/openings/OpeningsReviewBlock';
import { MixedTrainingModal } from '@/components/openings/MixedTrainingModal';
import { ImportPgnModal } from '@/components/openings/ImportPgnModal';
import { folderNameFromPgnFilename } from '@/lib/repertoire/folderNameFromPgnFilename';

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
    setFolderSide,
  } = useRepertoireLibrary();

  const trainable = getTrainableFolders();
  const [mixedSelect, setMixedSelect] = useState<Set<string>>(new Set());
  const [mixedOpen, setMixedOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RepertoireFolder | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [filename, setFilename] = useState('lignes.pgn');
  const [pgnText, setPgnText] = useState('');
  const [importSide, setImportSide] = useState<RepertoireSide | null>(null);
  const [lastImportResult, setLastImportResult] = useState<
    Awaited<ReturnType<typeof importPgn>> | null
  >(null);

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

  const openCreate = useCallback(() => {
    setNameDraft('');
    setFormError(null);
    setCreateOpen(true);
  }, []);

  const openRename = useCallback((folder: RepertoireFolder) => {
    setRenameTarget(folder);
    setNameDraft(folder.name);
    setFormError(null);
  }, []);

  const openImport = useCallback(() => {
    setFilename('lignes.pgn');
    setPgnText('');
    setFormError(null);
    setLastImportResult(null);
    setImportSide(null);
    setImportOpen(true);
  }, []);

  const createFolderUnique = useCallback(
    async (desiredName: string) => {
      let candidate = desiredName.trim() || 'PGN';
      let attempt = 1;
      for (;;) {
        try {
          return await createFolder(candidate);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Name collision — try "Name (2)", "Name (3)", …
          if (attempt >= 20) throw err;
          attempt += 1;
          candidate = `${desiredName.trim() || 'PGN'} (${attempt})`;
          // If the error wasn't a name clash, still retry a few times then rethrow.
          if (!/existe|exists|déjà|already/i.test(message) && attempt > 2) {
            throw err;
          }
        }
      }
    },
    [createFolder],
  );

  const submitCreate = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    try {
      await createFolder(nameDraft);
      setCreateOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [createFolder, nameDraft]);

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

  const submitImport = useCallback(async () => {
    if (!importSide) {
      setFormError(t('openings.importSideRequired'));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const folder = await createFolderUnique(folderNameFromPgnFilename(filename));
      await setFolderSide(folder.id, importSide);
      const file = await importPgn(folder.id, filename, pgnText);
      setLastImportResult(file);
      if (file.summary.parseSucceeded) {
        setTimeout(() => {
          setImportOpen(false);
          setLastImportResult(null);
        }, 900);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    importSide,
    createFolderUnique,
    filename,
    pgnText,
    importPgn,
    setFolderSide,
    t,
  ]);

  const onPickFile = useCallback(async () => {
    setFormError(null);
    try {
      const picked = await pickPgnFile();
      if (!picked) return;
      setFilename(picked.filename);
      setPgnText(picked.text);
    } catch {
      setFormError(t('openings.fileReadError'));
    }
  }, [t]);

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
          <Pressable
            onPress={openCreate}
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

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : folders.length === 0 ? (
        <OpeningEmptyState onImport={openImport} />
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
        onCancel={() => setCreateOpen(false)}
        onSubmit={submitCreate}
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
        onSubmit={submitRename}
        busy={busy}
        error={formError}
        submitLabel={t('common.save')}
      />

      <ImportPgnModal
        visible={importOpen}
        replaceTarget={null}
        filename={filename}
        onFilenameChange={setFilename}
        pgnText={pgnText}
        onPgnTextChange={setPgnText}
        busy={busy}
        formError={formError}
        showSidePicker
        importSide={importSide}
        onImportSideChange={setImportSide}
        lastImportResult={lastImportResult}
        onPickFile={onPickFile}
        onCancel={() => {
          setImportOpen(false);
          setLastImportResult(null);
        }}
        onSubmit={submitImport}
        onRequestClose={() => {
          setImportOpen(false);
          setLastImportResult(null);
        }}
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
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
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
