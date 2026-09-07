/**
 * Game Library — import and open PGN games for Lecteur de parties.
 */
import React, { useCallback, useEffect, useState } from 'react';
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
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import {
  gameLibraryStore,
  gameHasUsableName,
  gameLibraryTitle,
  gameSubtitle,
  importPgnGames,
  type ImportedChessGame,
} from '@/lib/gameLibrary';

type NamePromptState = {
  games: ImportedChessGame[];
  index: number;
  draft: string;
  skippedDuplicates: number;
  skippedInvalid: number;
  errors: string[];
};

export default function PartiesLibraryScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useAppSafeInsets();
  const router = useRouter();
  const [games, setGames] = useState<ImportedChessGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);

  const reload = useCallback(async () => {
    const list = await gameLibraryStore.listGames();
    setGames(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const finishImportStatus = (
    importedCount: number,
    skippedDuplicates: number,
    skippedInvalid: number,
    errors: string[],
  ) => {
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
    if (importedCount === 0 && errors[0]) {
      setStatus(errors[0]);
    } else {
      setStatus(parts.join(' · ') || t('parties.importNone'));
    }
  };

  const onImport = async () => {
    setImporting(true);
    setStatus(null);
    try {
      const picked = await pickPgnFile();
      if (!picked) {
        setImporting(false);
        return;
      }
      const existing = new Set(
        (await gameLibraryStore.listGames()).map((g) => g.fingerprint),
      );
      const preview = importPgnGames(picked.text, {
        fileName: picked.filename,
        existingFingerprints: existing,
        importedAt: Date.now(),
      });
      const needsName = preview.imported.some(
        (g) => !gameHasUsableName(g.headers) && !g.displayName?.trim(),
      );
      if (needsName && preview.imported.length > 0) {
        const index = preview.imported.findIndex(
          (g) => !gameHasUsableName(g.headers) && !g.displayName?.trim(),
        );
        setNamePrompt({
          games: preview.imported,
          index: Math.max(0, index),
          draft: '',
          skippedDuplicates: preview.skippedDuplicates,
          skippedInvalid: preview.skippedInvalid,
          errors: preview.errors,
        });
        return;
      }
      await gameLibraryStore.addGames(preview.imported);
      await reload();
      finishImportStatus(
        preview.imported.length,
        preview.skippedDuplicates,
        preview.skippedInvalid,
        preview.errors,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('parties.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const cancelNamePrompt = () => {
    setNamePrompt(null);
    setStatus(t('parties.importCancelled'));
  };

  const submitNamePrompt = async () => {
    if (!namePrompt) return;
    const name = namePrompt.draft.trim();
    if (!name) {
      setStatus(t('parties.nameRequired'));
      return;
    }
    const gamesNamed = namePrompt.games.map((g, i) =>
      i === namePrompt.index ? { ...g, displayName: name } : g,
    );
    const nextIdx = gamesNamed.findIndex(
      (g, i) =>
        i > namePrompt.index &&
        !gameHasUsableName(g.headers) &&
        !g.displayName?.trim(),
    );
    if (nextIdx >= 0) {
      setNamePrompt({
        ...namePrompt,
        games: gamesNamed,
        index: nextIdx,
        draft: '',
      });
      setStatus(null);
      return;
    }
    setNamePrompt(null);
    setImporting(true);
    try {
      await gameLibraryStore.addGames(gamesNamed);
      await reload();
      finishImportStatus(
        gamesNamed.length,
        namePrompt.skippedDuplicates,
        namePrompt.skippedInvalid,
        namePrompt.errors,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('parties.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const onDelete = (game: ImportedChessGame) => {
    const title = t('parties.deleteTitle');
    const message = t('parties.deleteConfirmMessage');
    const doDelete = () => {
      void gameLibraryStore.deleteGame(game.id).then(reload);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`${title}\n${message}`)) doDelete();
      return;
    }
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('parties.deleteConfirm'),
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
        onBack={() => router.back()}
        title={t('parties.title')}
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

      <Pressable
        testID="parties-open-workspace"
        onPress={() => router.push('/parties/analyzer' as Href)}
        style={({ pressed }) => [
          styles.importBtn,
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: colors.foreground,
            fontSize: 15,
            fontFamily: DesignTokens.typography.weightSemiBold,
          }}
        >
          {t('parties.openWorkspace')}
        </Text>
      </Pressable>

      {status ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>{status}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : games.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          {t('parties.empty')}
        </Text>
      ) : (
        <View style={styles.list}>
          {games.map((game) => (
            <View
              key={game.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
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
                {game.analysis?.hasBeenAnalyzed ? (
                  <Text
                    style={[styles.meta, { color: colors.primary }]}
                    testID={`parties-analyzed-${game.id}`}
                  >
                    {t('parties.anyliseurAnalyzed')}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                testID={`parties-delete-${game.id}`}
                accessibilityLabel={t('parties.deleteConfirm')}
                onPress={() => onDelete(game)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color="#c44" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={namePrompt != null}
        transparent
        animationType="fade"
        onRequestClose={cancelNamePrompt}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="parties-name-prompt"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('parties.gameName')}
            </Text>
            <TextInput
              testID="parties-name-input"
              value={namePrompt?.draft ?? ''}
              onChangeText={(draft) =>
                setNamePrompt((prev) => (prev ? { ...prev, draft } : prev))
              }
              placeholder={t('parties.gameNamePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
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
                onPress={cancelNamePrompt}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                testID="parties-name-import"
                onPress={() => void submitNamePrompt()}
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontFamily: DesignTokens.typography.weightSemiBold,
                  }}
                >
                  {t('parties.importAction')}
                </Text>
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
    width: 48,
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
});
