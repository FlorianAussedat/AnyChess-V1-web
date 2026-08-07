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
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import type { RepertoireFolder, ReviewSideFilter } from '@/lib/repertoire';
import { filterFoldersByReviewSide } from '@/lib/repertoire';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FolderListRow } from '@/components/openings/FolderListRow';
import { NameModal } from '@/components/openings/NameModal';
import { OpeningsReviewBlock } from '@/components/openings/OpeningsReviewBlock';
import { MixedTrainingModal } from '@/components/openings/MixedTrainingModal';

export default function OpeningsFolderList() {
  const colors = useColors();
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
  } = useRepertoireLibrary();

  const trainable = getTrainableFolders();
  const [mixedSelect, setMixedSelect] = useState<Set<string>>(new Set());
  const [mixedOpen, setMixedOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RepertoireFolder | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      const fileCount = getFiles(folder.id).length;
      const message =
        fileCount > 0
          ? `Supprimer « ${folder.name} » et ses ${fileCount} fichier${fileCount > 1 ? 's' : ''} PGN ? Cette action est irréversible.`
          : `Supprimer le dossier « ${folder.name} » ?`;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(message)) {
          deleteFolder(folder.id).catch(() => {});
        }
        return;
      }

      Alert.alert('Supprimer le dossier', message, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteFolder(folder.id).catch(() => {});
          },
        },
      ]);
    },
    [deleteFolder, getFiles],
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
        title="Ouvertures"
        subtitle="Répertoires PGN"
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
              Nouveau
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
        <View style={styles.centered}>
          <Ionicons name="folder-open-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucun répertoire
          </Text>
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            Crée un dossier (ex. Dragon accéléré, Caro-Kann) puis importe tes fichiers PGN.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {whiteFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                RÉPERTOIRE BLANCS
              </Text>
              {whiteFolders.map(renderFolderRow)}
            </View>
          )}
          {blackFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                RÉPERTOIRE NOIRS
              </Text>
              {blackFolders.map(renderFolderRow)}
            </View>
          )}
          {unassignedFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                SANS CÔTÉ
              </Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                Ouvre chaque dossier et choisis « Je joue Blancs » ou « Je joue Noirs » à l’import.
              </Text>
              {unassignedFolders.map(renderFolderRow)}
            </View>
          )}
        </ScrollView>
      )}

      <NameModal
        visible={createOpen}
        title="Nouveau répertoire"
        placeholder="Ex. Dragon accéléré"
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setCreateOpen(false)}
        onSubmit={submitCreate}
        busy={busy}
        error={formError}
        submitLabel="Créer"
      />

      <NameModal
        visible={renameTarget != null}
        title="Renommer le répertoire"
        placeholder="Nouveau nom"
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setRenameTarget(null)}
        onSubmit={submitRename}
        busy={busy}
        error={formError}
        submitLabel="Enregistrer"
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
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
  emptyMsg: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
});
