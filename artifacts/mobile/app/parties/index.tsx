/**
 * Game Library — folders + multi-PGN import for the unified workspace.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  countFolderContents,
  displayNameFromFilename,
  gameLibraryStore,
  gameLibraryTitle,
  gameSubtitle,
  MAX_PGN_IMPORT_BATCH,
  type GameLibraryFolder,
  type ImportedChessGame,
} from '@/lib/gameLibrary';
import {
  pickPgnFiles,
  type PickedPgnCandidate,
} from '@/lib/gameLibrary/pickPgnFiles';
import {
  formatPgnGameIndexTitle,
  indexPgnGamesLight,
  type PgnGameIndexEntry,
} from '@/lib/gameLibrary/indexPgnGamesLight';
import { PgnGameSelectModal, type PgnGameSelectCandidate } from '@/components/parties/PgnGameSelectModal';
import type { PickedPgnFile } from '@/lib/repertoire/pickPgnFile';

type RenameOffer = {
  gameId: string;
  fileName: string;
  currentName: string;
};

type RenameEdit = {
  gameId: string;
  draft: string;
};

type IndexedSource = {
  filename: string;
  text: string;
  entries: PgnGameIndexEntry[];
  indexedMs: number;
};

type GameSelectState = {
  sources: IndexedSource[];
  candidates: PgnGameSelectCandidate[];
  selected: Set<string>;
  indexHint: string | null;
};

export default function PartiesLibraryScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useAppSafeInsets();
  const router = useRouter();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<GameLibraryFolder[]>([]);
  const [folders, setFolders] = useState<GameLibraryFolder[]>([]);
  const [games, setGames] = useState<ImportedChessGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [renameOffer, setRenameOffer] = useState<RenameOffer | null>(null);
  const [renameEdit, setRenameEdit] = useState<RenameEdit | null>(null);
  const [pendingOffers, setPendingOffers] = useState<RenameOffer[]>([]);
  const [multiSelect, setMultiSelect] = useState<{
    candidates: PickedPgnCandidate[];
    selected: Set<string>;
    resolveSelected: (ids: string[]) => Promise<PickedPgnFile[]>;
  } | null>(null);
  const [gameSelect, setGameSelect] = useState<GameSelectState | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderDraft, setNewFolderDraft] = useState('');

  const reload = useCallback(async () => {
    const [folderList, gameList] = await Promise.all([
      gameLibraryStore.listFolders(folderId),
      gameLibraryStore.listGames(folderId),
    ]);
    setFolders(folderList);
    setGames(gameList);
    setLoading(false);
  }, [folderId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const title = useMemo(() => {
    if (folderStack.length === 0) return t('parties.title');
    return folderStack[folderStack.length - 1]!.name;
  }, [folderStack, t]);

  const queueRenameOffers = (offers: RenameOffer[]) => {
    if (offers.length === 0) return;
    const [first, ...rest] = offers;
    setPendingOffers(rest);
    setRenameOffer(first!);
  };

  const advanceRenameOffers = () => {
    setPendingOffers((prev) => {
      if (prev.length === 0) {
        setRenameOffer(null);
        return prev;
      }
      const [next, ...rest] = prev;
      setRenameOffer(next!);
      return rest;
    });
  };

  const importFiles = async (files: PickedPgnFile[]) => {
    // Light-index every file first — never parse all movetexts of a multi-game PGN.
    const sources: IndexedSource[] = [];
    for (const file of files) {
      const indexed = indexPgnGamesLight(file.text);
      sources.push({
        filename: file.filename,
        text: file.text,
        entries: indexed.entries,
        indexedMs: indexed.indexedMs,
      });
    }

    const candidates: PgnGameSelectCandidate[] = [];
    for (let s = 0; s < sources.length; s += 1) {
      const source = sources[s]!;
      for (const entry of source.entries) {
        candidates.push({
          ...entry,
          id: `${s}:${entry.index}`,
          sourceLabel:
            sources.length > 1 ? source.filename : undefined,
        });
      }
    }

    if (candidates.length === 0) {
      setStatus(t('parties.importNone'));
      return;
    }

    // Single game → import immediately (simple path).
    if (candidates.length === 1) {
      await importSelectedGames(sources, [candidates[0]!.id]);
      return;
    }

    // Multi-game (even small) → same selection UI; never auto-import all.
    const totalMs = sources.reduce((acc, s) => acc + s.indexedMs, 0);
    setGameSelect({
      sources,
      candidates,
      selected: new Set(),
      indexHint: t('parties.gameSelectIndexed', {
        count: String(candidates.length),
        ms: String(totalMs),
      }),
    });
  };

  const importSelectedGames = async (
    sources: IndexedSource[],
    selectedIds: string[],
  ) => {
    let importedCount = 0;
    let skippedDuplicates = 0;
    let skippedInvalid = 0;
    const errors: string[] = [];
    const offers: RenameOffer[] = [];

    const bySource = new Map<number, number[]>();
    for (const id of selectedIds.slice(0, MAX_PGN_IMPORT_BATCH)) {
      const [sRaw, iRaw] = id.split(':');
      const s = Number(sRaw);
      const index = Number(iRaw);
      if (!Number.isFinite(s) || !Number.isFinite(index)) continue;
      const list = bySource.get(s) ?? [];
      list.push(index);
      bySource.set(s, list);
    }

    const jobs: Array<{ source: IndexedSource; indices: number[] }> = [];
    for (const [s, indices] of bySource) {
      const source = sources[s];
      if (!source || indices.length === 0) continue;
      jobs.push({ source, indices });
    }

    let done = 0;
    const total = selectedIds.length;
    for (const job of jobs) {
      const displayNames: Record<number, string> = {};
      for (const index of job.indices) {
        const entry = job.source.entries.find((e) => e.index === index);
        if (entry) {
          const title = formatPgnGameIndexTitle(entry).replace(/\n/g, ' · ');
          displayNames[index] = title;
        }
      }

      // Import one selected game at a time for progress + rename queue.
      for (const index of job.indices) {
        done += 1;
        setImportProgress(
          t('parties.importProgress', {
            done: String(done),
            total: String(total),
          }),
        );
        try {
          const multiGameFile = job.source.entries.length > 1;
          const result = await gameLibraryStore.importPgnText(
            job.source.text,
            job.source.filename,
            {
              folderId,
              useFileNameAsDisplayName: !multiGameFile,
              gameIndices: [index],
              indexEntries: job.source.entries,
              displayNames: multiGameFile
                ? {
                    [index]:
                      displayNames[index] ??
                      displayNameFromFilename(job.source.filename),
                  }
                : undefined,
            },
          );
          importedCount += result.imported.length;
          skippedDuplicates += result.skippedDuplicates;
          skippedInvalid += result.skippedInvalid;
          errors.push(...result.errors);
          for (const game of result.imported) {
            const currentName =
              game.displayName?.trim() ||
              displayNames[index] ||
              displayNameFromFilename(job.source.filename) ||
              gameLibraryTitle(game);
            offers.push({
              gameId: game.id,
              fileName: job.source.filename,
              currentName,
            });
          }
        } catch (e) {
          skippedInvalid += 1;
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
    }

    await reload();
    const parts: string[] = [];
    if (importedCount > 0) {
      parts.push(t('parties.importOk', { count: importedCount }));
    }
    if (skippedDuplicates > 0) {
      parts.push(t('parties.importDuplicates', { count: skippedDuplicates }));
    }
    if (skippedInvalid > 0) {
      parts.push(t('parties.importSkipped', { count: skippedInvalid }));
    }
    setStatus(parts.join(' · ') || errors[0] || t('parties.importNone'));
    setImportProgress(null);
    queueRenameOffers(offers);
  };

  const onImport = async () => {
    setImporting(true);
    setStatus(null);
    try {
      const picked = await pickPgnFiles();
      if (picked.kind === 'cancelled') return;
      if (picked.kind === 'needsSelection') {
        setMultiSelect({
          candidates: picked.candidates,
          selected: new Set(),
          resolveSelected: picked.resolveSelected,
        });
        return;
      }
      await importFiles(picked.files);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('parties.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const confirmMultiSelect = async () => {
    if (!multiSelect) return;
    const ids = [...multiSelect.selected].slice(0, MAX_PGN_IMPORT_BATCH);
    setImporting(true);
    try {
      const files = await multiSelect.resolveSelected(ids);
      setMultiSelect(null);
      await importFiles(files);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('parties.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const confirmGameSelect = async () => {
    if (!gameSelect || gameSelect.selected.size === 0) return;
    const ids = [...gameSelect.selected].slice(0, MAX_PGN_IMPORT_BATCH);
    const sources = gameSelect.sources;
    setGameSelect(null);
    setImporting(true);
    try {
      await importSelectedGames(sources, ids);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('parties.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const onDeleteGame = (game: ImportedChessGame) => {
    const doDelete = () => {
      void gameLibraryStore.deleteGame(game.id).then(reload);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`${t('parties.deleteTitle')}\n${t('parties.deleteConfirmMessage')}`)) {
        doDelete();
      }
      return;
    }
    Alert.alert(t('parties.deleteTitle'), t('parties.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('parties.deleteConfirm'), style: 'destructive', onPress: doDelete },
    ]);
  };

  const openFolder = (folder: GameLibraryFolder) => {
    setFolderStack((s) => [...s, folder]);
    setFolderId(folder.id);
  };

  const goUp = () => {
    setFolderStack((s) => {
      const next = s.slice(0, -1);
      setFolderId(next.length ? next[next.length - 1]!.id : null);
      return next;
    });
  };

  const createFolder = async () => {
    const name = newFolderDraft.trim();
    if (!name) return;
    await gameLibraryStore.createFolder(name, folderId);
    setNewFolderOpen(false);
    setNewFolderDraft('');
    await reload();
  };

  const onDeleteFolder = async (folder: GameLibraryFolder) => {
    const snap = await gameLibraryStore.getSnapshot();
    const counts = countFolderContents(snap, folder.id);
    const message = t('parties.folderDeleteConfirm', {
      games: String(counts.games),
      folders: String(counts.subfolders),
    });
    const doDelete = () => {
      void gameLibraryStore
        .deleteFolder(folder.id, { deleteContents: true })
        .then(reload);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(message)) doDelete();
      return;
    }
    Alert.alert(t('parties.folderDeleteTitle'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('parties.folderDeleteAll'),
        style: 'destructive',
        onPress: doDelete,
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      testID="parties-library"
    >
      <ScreenHeader
        onBack={() => {
          if (folderStack.length > 0) goUp();
          else router.back();
        }}
        title={title}
        subtitle={t('parties.subtitle')}
        backTestID="parties-back"
      />

      <Pressable
        testID="parties-import"
        disabled={importing}
        onPress={() => void onImport()}
        style={({ pressed }) => [
          styles.importBtn,
          {
            backgroundColor: colors.primary,
            opacity: pressed || importing ? 0.8 : 1,
          },
        ]}
      >
        {importing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="document-attach-outline" size={20} color="#fff" />
            <Text style={styles.importText}>{t('parties.importPgn')}</Text>
          </>
        )}
      </Pressable>

      <View style={styles.rowBtns}>
        <Pressable
          testID="parties-new-folder"
          onPress={() => setNewFolderOpen(true)}
          style={[
            styles.secondaryBtn,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Text style={{ color: colors.foreground }}>
            {t('parties.newFolder')}
          </Text>
        </Pressable>
        <Pressable
          testID="parties-open-workspace"
          onPress={() => router.push('/parties/analyzer')}
          style={[
            styles.secondaryBtn,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Text style={{ color: colors.foreground }}>
            {t('parties.openWorkspace')}
          </Text>
        </Pressable>
      </View>

      {importProgress ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>
          {importProgress}
        </Text>
      ) : null}
      {status ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>
          {status}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : folders.length === 0 && games.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          {t('parties.empty')}
        </Text>
      ) : (
        <View style={styles.list}>
          {folders.map((folder) => (
            <View
              key={folder.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Pressable
                testID={`parties-folder-${folder.id}`}
                onPress={() => openFolder(folder)}
                style={styles.cardMain}
              >
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  📁 {folder.name}
                </Text>
              </Pressable>
              <Pressable
                testID={`parties-folder-delete-${folder.id}`}
                onPress={() => void onDeleteFolder(folder)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color="#c44" />
              </Pressable>
            </View>
          ))}
          {games.map((game) => (
            <View
              key={game.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Pressable
                testID={`parties-game-${game.id}`}
                onPress={() =>
                  router.push({
                    pathname: '/parties/analyzer',
                    params: { gameId: game.id },
                  })
                }
                style={styles.cardMain}
              >
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  {gameLibraryTitle(game)}
                </Text>
                {game.headers.result ? (
                  <Text style={[styles.result, { color: colors.primary }]}>
                    {game.headers.result}
                  </Text>
                ) : null}
                <Text
                  style={[styles.cardSub, { color: colors.mutedForeground }]}
                >
                  {gameSubtitle(game) || t('parties.noMeta')}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {t('parties.moveCount', { count: game.moves.length })}
                </Text>
                {game.analysis?.hasBeenAnalyzed ? (
                  <Text style={[styles.meta, { color: colors.primary }]}>
                    {t('parties.anyliseurAnalyzed')}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                testID={`parties-rename-${game.id}`}
                onPress={() =>
                  setRenameEdit({
                    gameId: game.id,
                    draft: gameLibraryTitle(game),
                  })
                }
                style={styles.deleteBtn}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.foreground} />
              </Pressable>
              <Pressable
                testID={`parties-delete-${game.id}`}
                onPress={() => onDeleteGame(game)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color="#c44" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Post-import rename offer */}
      <Modal
        visible={renameOffer != null}
        transparent
        animationType="fade"
        onRequestClose={advanceRenameOffers}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="parties-rename-offer"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('parties.importRenameOffer', {
                file: renameOffer?.fileName ?? '',
              })}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                testID="parties-rename-no"
                onPress={advanceRenameOffers}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>{t('common.no')}</Text>
              </Pressable>
              <Pressable
                testID="parties-rename-yes"
                onPress={() => {
                  if (!renameOffer) return;
                  setRenameEdit({
                    gameId: renameOffer.gameId,
                    draft: renameOffer.currentName,
                  });
                  setRenameOffer(null);
                }}
                style={[
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: '#fff' }}>{t('common.yes')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename editor */}
      <Modal
        visible={renameEdit != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRenameEdit(null);
          advanceRenameOffers();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="parties-rename-edit"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('parties.gameName')}
            </Text>
            <TextInput
              testID="parties-name-input"
              value={renameEdit?.draft ?? ''}
              onChangeText={(draft) =>
                setRenameEdit((prev) => (prev ? { ...prev, draft } : prev))
              }
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                testID="parties-name-cancel"
                onPress={() => {
                  setRenameEdit(null);
                  advanceRenameOffers();
                }}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                testID="parties-name-save"
                onPress={() => {
                  void (async () => {
                    if (!renameEdit) return;
                    await gameLibraryStore.renameGame(
                      renameEdit.gameId,
                      renameEdit.draft,
                    );
                    setRenameEdit(null);
                    await reload();
                    advanceRenameOffers();
                  })();
                }}
                style={[
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: '#fff' }}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Multi-game PGN picker (virtualized) */}
      <PgnGameSelectModal
        visible={gameSelect != null}
        candidates={gameSelect?.candidates ?? []}
        selected={gameSelect?.selected ?? new Set()}
        indexingLabel={gameSelect?.indexHint}
        onChangeSelected={(next) => {
          setGameSelect((prev) => (prev ? { ...prev, selected: next } : prev));
        }}
        onCancel={() => setGameSelect(null)}
        onConfirm={() => void confirmGameSelect()}
      />

      {/* Multi-select when >10 files */}
      <Modal
        visible={multiSelect != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMultiSelect(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                maxHeight: '80%',
              },
            ]}
            testID="parties-multi-select"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('parties.multiSelectTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>
              {t('parties.multiSelectCount', {
                selected: String(multiSelect?.selected.size ?? 0),
                max: String(MAX_PGN_IMPORT_BATCH),
              })}
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {multiSelect?.candidates.map((c) => {
                const selected = multiSelect.selected.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    testID={`parties-multi-${c.id}`}
                    onPress={() => {
                      setMultiSelect((prev) => {
                        if (!prev) return prev;
                        const next = new Set(prev.selected);
                        if (next.has(c.id)) next.delete(c.id);
                        else if (next.size < MAX_PGN_IMPORT_BATCH) next.add(c.id);
                        return { ...prev, selected: next };
                      });
                    }}
                    style={[
                      styles.multiRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected
                          ? colors.primary
                          : colors.secondary,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                      }}
                    >
                      {c.filename}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMultiSelect(null)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                testID="parties-multi-import"
                disabled={!multiSelect || multiSelect.selected.size === 0}
                onPress={() => void confirmMultiSelect()}
                style={[
                  styles.modalBtnPrimary,
                  {
                    backgroundColor: colors.primary,
                    opacity:
                      !multiSelect || multiSelect.selected.size === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={{ color: '#fff' }}>{t('parties.importAction')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* New folder */}
      <Modal
        visible={newFolderOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNewFolderOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('parties.newFolder')}
            </Text>
            <TextInput
              value={newFolderDraft}
              onChangeText={setNewFolderDraft}
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setNewFolderOpen(false)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void createFolder()}
                style={[
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: '#fff' }}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: 14,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: DesignTokens.radius.md,
    paddingHorizontal: 16,
  },
  importText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  rowBtns: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  status: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightRegular,
    lineHeight: 18,
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  list: { gap: 10 },
  card: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  cardMain: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  result: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalBtnPrimary: {
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  multiRow: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    padding: 10,
    marginBottom: 6,
  },
});
