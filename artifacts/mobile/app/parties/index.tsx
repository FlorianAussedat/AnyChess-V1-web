/**
 * Game analysis library — folders + saved analyses.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LibraryActionRow } from '@/components/library/LibraryActionRow';
import { LibraryFolderFab } from '@/components/library/LibraryFolderFab';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { confirmAction } from '@/lib/openings/confirmAction';
import {
  countFolderContents,
  gameLibraryStore,
  gameLibraryTitle,
  gameSubtitle,
  isUnfiledGameFolder,
  type GameLibraryFolder,
  type ImportedChessGame,
} from '@/lib/gameLibrary';
import { sessionAnalysisStore } from '@/lib/analysis/sessionAnalysisStore';
import { FolderPickModal } from '@/components/openings/FolderPickModal';
import { NameModal } from '@/components/openings/NameModal';
import { RepertoireSidePicker } from '@/components/RepertoireSidePicker';
import {
  repertoireService,
  type RepertoireFolder,
  type RepertoireSide,
} from '@/lib/repertoire';
import { PgnTranslationActions } from '@/components/pgn/PgnTranslationActions';

function importedGameToPgn(game: ImportedChessGame): string | null {
  const raw = game.source.rawPgn?.trim();
  if (raw) return raw;

  const tags: Array<[string, string | undefined]> = [
    ['Event', game.headers.event],
    ['Site', game.headers.site],
    ['Date', game.headers.date],
    ['Round', game.headers.round],
    ['White', game.headers.white],
    ['Black', game.headers.black],
    ['Result', game.headers.result],
    ['ECO', game.headers.eco],
    ['Opening', game.headers.opening],
    ['WhiteElo', game.headers.whiteElo],
    ['BlackElo', game.headers.blackElo],
  ];
  if (
    game.initialFen &&
    !game.initialFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
  ) {
    tags.push(['SetUp', '1'], ['FEN', game.initialFen]);
  }
  const headerLines = tags
    .filter(([, v]) => Boolean(v && String(v).trim()))
    .map(([k, v]) => `[${k} "${String(v).replace(/"/g, '')}"]`);
  if (game.moves.length === 0 && headerLines.length === 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < game.moves.length; i++) {
    const m = game.moves[i]!;
    if (i % 2 === 0) parts.push(`${Math.floor(i / 2) + 1}.`);
    parts.push(m.san);
  }
  const result = game.headers.result?.trim() || '*';
  const movetext = parts.length > 0 ? `${parts.join(' ')} ${result}` : result;
  return `${headerLines.join('\n')}\n\n${movetext}`.trim();
}

type RenameEdit = {
  gameId: string;
  draft: string;
};

export default function PartiesLibraryScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<GameLibraryFolder[]>([]);
  const [folders, setFolders] = useState<GameLibraryFolder[]>([]);
  const [allFolders, setAllFolders] = useState<GameLibraryFolder[]>([]);
  const [games, setGames] = useState<ImportedChessGame[]>([]);
  const [allGames, setAllGames] = useState<ImportedChessGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [renameEdit, setRenameEdit] = useState<RenameEdit | null>(null);
  const [moveGame, setMoveGame] = useState<ImportedChessGame | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderDraft, setNewFolderDraft] = useState('');
  const [sessionAnalyzedTick, setSessionAnalyzedTick] = useState(0);

  const [openingsFolders, setOpeningsFolders] = useState<RepertoireFolder[]>([]);
  const [addToOpeningsGame, setAddToOpeningsGame] =
    useState<ImportedChessGame | null>(null);
  const [openingsCreateOpen, setOpeningsCreateOpen] = useState(false);
  const [openingsCreateDraft, setOpeningsCreateDraft] = useState('');
  const [openingsCreateSide, setOpeningsCreateSide] = useState<RepertoireSide | null>(
    null,
  );
  const [openingsBusy, setOpeningsBusy] = useState(false);
  const [openingsFormError, setOpeningsFormError] = useState<string | null>(null);

  useEffect(() => {
    return sessionAnalysisStore.subscribe(() => {
      setSessionAnalyzedTick((n) => n + 1);
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      const [folderList, gameList, snap] = await Promise.all([
        gameLibraryStore.listFolders(folderId),
        gameLibraryStore.listGames(folderId),
        gameLibraryStore.getSnapshot(),
      ]);
      setFolders(folderList);
      setGames(gameList);
      setAllGames(snap.games);
      setAllFolders(snap.folders);
    } catch {
      setFolders([]);
      setGames([]);
      setStatus(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [folderId, t]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const title = useMemo(() => {
    if (folderStack.length === 0) return t('parties.title');
    const current = folderStack[folderStack.length - 1]!;
    return isUnfiledGameFolder(current) ? t('parties.unfiledFolder') : current.name;
  }, [folderStack, t]);

  const onDeleteGame = (game: ImportedChessGame) => {
    confirmAction(
      t('parties.deleteTitle'),
      t('parties.deleteConfirmMessage'),
      () => {
        void gameLibraryStore.deleteGame(game.id).then(reload);
      },
      { destructive: true, confirmLabel: t('parties.deleteConfirm') },
    );
  };

  const openAddToOpenings = useCallback(async (game: ImportedChessGame) => {
    setStatus(null);
    setOpeningsFormError(null);
    try {
      await repertoireService.ensureLoaded();
      setOpeningsFolders(repertoireService.getFolders());
      setAddToOpeningsGame(game);
      setOpeningsCreateOpen(false);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('openings.addToOpeningsFail'));
    }
  }, [t]);

  const importGameIntoOpeningsFolder = useCallback(
    async (targetFolderId: string) => {
      if (!addToOpeningsGame) return;
      const pgn = importedGameToPgn(addToOpeningsGame);
      if (!pgn) {
        setStatus(t('openings.noPgnInGame'));
        setAddToOpeningsGame(null);
        return;
      }
      setOpeningsBusy(true);
      setOpeningsFormError(null);
      try {
        const folder = repertoireService.getFolder(targetFolderId);
        const filename =
          addToOpeningsGame.source.fileName?.trim() ||
          `${gameLibraryTitle(addToOpeningsGame).replace(/\s+/g, '_') || 'game'}.pgn`;
        await repertoireService.importPgn(
          targetFolderId,
          filename,
          pgn,
          gameLibraryTitle(addToOpeningsGame),
        );
        setAddToOpeningsGame(null);
        setOpeningsCreateOpen(false);
        setStatus(
          t('openings.addToOpeningsDone', {
            name: folder?.name ?? targetFolderId,
          }),
        );
      } catch (e) {
        setStatus(e instanceof Error ? e.message : t('openings.addToOpeningsFail'));
      } finally {
        setOpeningsBusy(false);
      }
    },
    [addToOpeningsGame, t],
  );

  const createOpeningsFolderAndImport = useCallback(async () => {
    if (!openingsCreateSide) {
      setOpeningsFormError(t('openings.sideRequired'));
      return;
    }
    setOpeningsBusy(true);
    setOpeningsFormError(null);
    try {
      const folder = await repertoireService.createFolder(
        openingsCreateDraft,
        openingsCreateSide,
      );
      setOpeningsFolders(repertoireService.getFolders());
      setOpeningsCreateOpen(false);
      setOpeningsCreateSide(null);
      await importGameIntoOpeningsFolder(folder.id);
    } catch (e) {
      setOpeningsFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpeningsBusy(false);
    }
  }, [importGameIntoOpeningsFolder, openingsCreateDraft, openingsCreateSide, t]);

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
    if (isUnfiledGameFolder(folder)) return;
    const snap = await gameLibraryStore.getSnapshot();
    const counts = countFolderContents(snap, folder.id);
    const message = t('parties.folderDeleteConfirm', {
      games: String(counts.games),
      folders: String(counts.subfolders),
    });
    confirmAction(
      t('parties.folderDeleteTitle'),
      message,
      () => {
        void gameLibraryStore
          .deleteFolder(folder.id, { deleteContents: true })
          .then(reload);
      },
      { destructive: true, confirmLabel: t('parties.folderDeleteAll') },
    );
  };

  const confirmMove = async (targetFolderId: string) => {
    if (!moveGame) return;
    await gameLibraryStore.moveGame(moveGame.id, targetFolderId);
    setMoveGame(null);
    await reload();
  };

  const atRoot = folderStack.length === 0;
  const empty = folders.length === 0 && games.length === 0;

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
        onBack={() => {
          if (folderStack.length > 0) goUp();
          else router.back();
        }}
        title={title}
        titleNumberOfLines={2}
        backTestID="parties-back"
      />

      {atRoot ? (
        <Text
          style={[styles.lead, { color: colors.mutedForeground }]}
          testID="parties-subtitle"
        >
          {t('parties.subtitle')}
        </Text>
      ) : null}

      {atRoot ? (
        <View style={styles.actionStack} testID="parties-primary-actions">
          <LibraryActionRow
            testID="parties-import"
            icon="arrow-up-outline"
            label={t('parties.importPgnFen')}
            onPress={() => router.push('/parties/import' as Href)}
          />
          <PgnTranslationActions
            source="gameLibrary"
            files={allGames
              .map((game) => ({
                id: game.id,
                filename: `${gameLibraryTitle(game)}.pgn`,
                pgnText: game.source.rawPgn ?? '',
              }))
              .filter((file) => file.pgnText.trim())}
            selectedIds={games.map((game) => game.id)}
            testID="parties-pgn-translation"
          />
          <LibraryActionRow
            testID="parties-start-initial"
            icon="grid-outline"
            label={t('parties.startFromInitial')}
            onPress={() =>
              router.push({
                pathname: '/parties/analyzer',
                params: { blank: '1', tab: 'analysis' },
              } as Href)
            }
          />
        </View>
      ) : null}

      {status ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>{status}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          testID="parties-library"
        >
          {empty && !atRoot ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {t('parties.emptyFolder')}
            </Text>
          ) : null}
          {folders.map((folder) => {
            const unfiled = isUnfiledGameFolder(folder);
            return (
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
                    {unfiled ? t('parties.unfiledFolder') : folder.name}
                  </Text>
                  {unfiled ? (
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                      {t('parties.folderLocked')}
                    </Text>
                  ) : null}
                </Pressable>
                {unfiled ? (
                  <View style={styles.deleteBtn} testID="parties-folder-locked-unfiled">
                    <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                  </View>
                ) : (
                  <Pressable
                    testID={`parties-folder-delete-${folder.id}`}
                    onPress={() => void onDeleteFolder(folder)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#c44" />
                  </Pressable>
                )}
              </View>
            );
          })}
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
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                  {gameSubtitle(game) || t('parties.noMeta')}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {t('parties.moveCount', { count: game.moves.length })}
                </Text>
                {sessionAnalyzedTick >= 0 &&
                sessionAnalysisStore.isGameFullyAnalyzed(game.id, game.fingerprint) ? (
                  <Text
                    style={[styles.meta, { color: colors.primary }]}
                    testID={`parties-analyzed-${game.id}`}
                  >
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
                testID={`parties-move-${game.id}`}
                onPress={() => setMoveGame(game)}
                style={styles.deleteBtn}
                accessibilityLabel={t('parties.moveGame')}
              >
                <Ionicons name="folder-outline" size={18} color={colors.foreground} />
              </Pressable>
              <Pressable
                testID={`parties-add-openings-${game.id}`}
                onPress={() => {
                  void openAddToOpenings(game);
                }}
                style={styles.deleteBtn}
                accessibilityLabel={t('openings.addToOpeningsFolder')}
              >
                <Ionicons name="library-outline" size={18} color={colors.foreground} />
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
        </ScrollView>
      )}

      <LibraryFolderFab
        label={t('parties.createFolderFab')}
        accessibilityLabel={t('parties.createFolderA11y')}
        onPress={() => setNewFolderOpen(true)}
        testID="parties-new-folder"
      />

      <Modal
        visible={renameEdit != null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameEdit(null)}
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
                onPress={() => setRenameEdit(null)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                testID="parties-name-save"
                onPress={() => {
                  void (async () => {
                    if (!renameEdit) return;
                    await gameLibraryStore.renameGame(renameEdit.gameId, renameEdit.draft);
                    setRenameEdit(null);
                    await reload();
                  })();
                }}
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#fff' }}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={moveGame != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveGame(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '80%' },
            ]}
            testID="parties-move-folder"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('parties.moveGame')}
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {allFolders
                .filter((f) => f.id !== moveGame?.folderId)
                .map((folder) => (
                  <Pressable
                    key={folder.id}
                    testID={`parties-move-to-${folder.id}`}
                    onPress={() => void confirmMove(folder.id)}
                    style={[
                      styles.multiRow,
                      { borderColor: colors.border, backgroundColor: colors.secondary },
                    ]}
                  >
                    <Text style={{ color: colors.foreground }}>
                      {isUnfiledGameFolder(folder)
                        ? t('parties.unfiledFolder')
                        : folder.name}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
            <Pressable
              onPress={() => setMoveGame(null)}
              style={[styles.modalBtn, { borderColor: colors.border, alignSelf: 'flex-end' }]}
            >
              <Text style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <FolderPickModal
        visible={addToOpeningsGame != null && !openingsCreateOpen}
        folders={openingsFolders}
        busy={openingsBusy}
        title={t('openings.addToOpeningsFolder')}
        onSelect={(id) => {
          void importGameIntoOpeningsFolder(id);
        }}
        onCreateFolder={() => {
          setOpeningsCreateDraft('');
          setOpeningsCreateSide(null);
          setOpeningsFormError(null);
          setOpeningsCreateOpen(true);
        }}
        onCancel={() => setAddToOpeningsGame(null)}
      />

      <NameModal
        visible={openingsCreateOpen}
        title={t('openings.newRepertoire')}
        placeholder={t('openings.namePlaceholder')}
        value={openingsCreateDraft}
        onChangeText={setOpeningsCreateDraft}
        onCancel={() => {
          setOpeningsCreateOpen(false);
          setOpeningsCreateSide(null);
        }}
        onSubmit={() => {
          void createOpeningsFolderAndImport();
        }}
        busy={openingsBusy}
        error={openingsFormError}
        submitLabel={t('openings.create')}
      >
        <View style={{ gap: 8, marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            {t('openings.setSide')}
          </Text>
          <RepertoireSidePicker
            value={openingsCreateSide}
            onChange={setOpeningsCreateSide}
          />
        </View>
      </NameModal>

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
                <Text style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void createFolder()}
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#fff' }}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: DesignTokens.spacing.screenX, gap: 12 },
  actionStack: { gap: 8 },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  status: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightRegular,
    lineHeight: 18,
  },
  empty: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  list: { gap: 10, paddingBottom: 88 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
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
    lineHeight: 22,
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
    borderRadius: 14,
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
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
});
