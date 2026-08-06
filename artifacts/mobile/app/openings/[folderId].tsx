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
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import type { StoredPgnFile, RepertoireSide } from '@/lib/repertoire';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import { sideLabel } from '@/components/RepertoireSidePicker';
import type { PlayerColor } from '@/contexts/GameContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HubModeCard } from '@/components/HubModeCard';
import { PgnFileRow } from '@/components/openings/PgnFileRow';
import { ImportPgnModal } from '@/components/openings/ImportPgnModal';
import { PlayOpeningModal } from '@/components/openings/PlayOpeningModal';
import { SideMigrationModal } from '@/components/openings/SideMigrationModal';
import { PgnFileDetailModal } from '@/components/openings/PgnFileDetailModal';

export default function FolderDetailScreen() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();

  const {
    ready,
    getFolder,
    getFiles,
    importPgn,
    replacePgn,
    deletePgn,
    setFolderSide,
    setFileEnabled,
  } = useRepertoireLibrary();

  const folder = folderId ? getFolder(folderId) : null;
  const files = useMemo(
    () => (folderId ? getFiles(folderId) : []),
    [folderId, getFiles],
  );

  const [importOpen, setImportOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<StoredPgnFile | null>(null);
  const [detailFile, setDetailFile] = useState<StoredPgnFile | null>(null);
  const [playOpen, setPlayOpen] = useState(false);
  const [sideMigrationOpen, setSideMigrationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'play' | 'continue' | null>(null);
  const [importSide, setImportSide] = useState<RepertoireSide | null>(null);
  const [migrationSide, setMigrationSide] = useState<RepertoireSide | null>(null);
  const [filename, setFilename] = useState('lignes.pgn');
  const [pgnText, setPgnText] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] = useState<StoredPgnFile | null>(null);

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

  const startPlay = useCallback(() => {
    if (!folderId || !canPlay || !folder?.side) return;
    setPlayOpen(false);
    const color: PlayerColor = folder.side === 'white' ? 'w' : 'b';
    router.push(
      `/openings/play?folderId=${encodeURIComponent(folderId)}&color=${color}` as Href,
    );
  }, [folderId, canPlay, folder?.side, router]);

  const openImport = useCallback(() => {
    setFilename('lignes.pgn');
    setPgnText('');
    setFormError(null);
    setLastImportResult(null);
    setReplaceTarget(null);
    setImportSide(folder?.side ?? null);
    setImportOpen(true);
  }, [folder?.side]);

  const openReplace = useCallback((file: StoredPgnFile) => {
    setReplaceTarget(file);
    setFilename(file.filename);
    setPgnText(file.pgnText);
    setFormError(null);
    setLastImportResult(null);
    setImportSide(folder?.side ?? null);
    setImportOpen(true);
  }, [folder?.side]);

  const submitImport = useCallback(async () => {
    if (!folderId) return;
    if (!folder?.side && !importSide) {
      setFormError('Indique de quel côté tu travailles ce répertoire.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (!folder?.side && importSide) {
        await setFolderSide(folderId, importSide);
      }
      let file: StoredPgnFile;
      if (replaceTarget) {
        file = await replacePgn(replaceTarget.id, pgnText, filename);
      } else {
        file = await importPgn(folderId, filename, pgnText);
      }
      setLastImportResult(file);
      if (file.summary.parseSucceeded) {
        // Keep modal open briefly so the user sees the summary, then close.
        setTimeout(() => {
          setImportOpen(false);
          setReplaceTarget(null);
          setLastImportResult(null);
        }, 900);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [folderId, folder?.side, importSide, filename, pgnText, replaceTarget, importPgn, replacePgn, setFolderSide]);

  const confirmDeleteFile = useCallback(
    (file: StoredPgnFile) => {
      const message = `Retirer « ${file.filename} » de ce répertoire ? Le dossier lui-même sera conservé.`;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(message)) {
          deletePgn(file.id).catch(() => {});
        }
        return;
      }
      Alert.alert('Retirer le fichier', message, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            deletePgn(file.id).catch(() => {});
          },
        },
      ]);
    },
    [deletePgn],
  );

  const onPickFile = useCallback(async () => {
    setFormError(null);
    try {
      const picked = await pickPgnFile();
      if (!picked) return;
      setFilename(picked.filename);
      setPgnText(picked.text);
    } catch {
      setFormError('Impossible de lire le fichier.');
    }
  }, []);

  const onToggleEnabled = useCallback(
    (file: StoredPgnFile) => {
      const next = file.enabled === false;
      setFileEnabled(file.id, next).catch(() => {});
    },
    [setFileEnabled],
  );

  if (!ready) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!folder) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <ScreenHeader onBack={() => router.back()} title="Dossier introuvable" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
        },
      ]}
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={folder.name}
        subtitle={`${files.length} fichier${files.length !== 1 ? 's' : ''} PGN${
          folder.side ? ` · ${sideLabel(folder.side)}` : ''
        }`}
        trailing={
          <Pressable
            onPress={openImport}
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
            <Text style={[styles.primaryBtnLabel, { color: colors.foreground }]}>Importer</Text>
          </Pressable>
        }
      />

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Plusieurs PGN dans ce dossier seront fusionnés en un seul arbre de répertoire
        (transpositions reconnues, doublons évités).
      </Text>

      <View style={styles.exerciseBlock}>
        <Text style={[styles.exerciseHeading, { color: colors.foreground }]}>Exercices</Text>
        <HubModeCard
          title="Jouer contre le répertoire"
          description="L’adversaire suit tes lignes importées, puis Stockfish hors livre."
          iconName="play-circle-outline"
          onPress={() => ensureSideThen('play')}
          disabled={!canPlay}
          testID="play-opening-btn"
        />
        <HubModeCard
          title="Continue la ligne"
          description="Récite la suite d’une branche choisie dans ce répertoire."
          iconName="mic-outline"
          onPress={() => ensureSideThen('continue')}
          disabled={!canPlay}
          testID="continue-line-btn"
        />
        <Text style={[styles.exerciseHeading, { color: colors.foreground, marginTop: 8 }]}>
          Gérer les PGN
        </Text>
      </View>

      {files.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-outline" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucun PGN importé
          </Text>
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            Importe un ou plusieurs fichiers .pgn (collage ou sélection de fichier).
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
              onReplace={openReplace}
              onDelete={confirmDeleteFile}
            />
          )}
        />
      )}

      <ImportPgnModal
        visible={importOpen}
        replaceTarget={replaceTarget}
        filename={filename}
        onFilenameChange={setFilename}
        pgnText={pgnText}
        onPgnTextChange={setPgnText}
        busy={busy}
        formError={formError}
        showSidePicker={!folder.side}
        importSide={importSide}
        onImportSideChange={setImportSide}
        lastImportResult={lastImportResult}
        onPickFile={onPickFile}
        onCancel={() => {
          setImportOpen(false);
          setReplaceTarget(null);
        }}
        onSubmit={submitImport}
        onRequestClose={() => setImportOpen(false)}
      />

      <PlayOpeningModal
        visible={playOpen}
        folderName={folder.name}
        folderSide={folder.side}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
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
  exerciseBlock: {
    gap: 8,
  },
  exerciseHeading: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 64,
  },
  exerciseTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  exerciseDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
    marginTop: 2,
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
