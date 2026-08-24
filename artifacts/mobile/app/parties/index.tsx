/**
 * Game Library — import and open PGN games for Lecteur de parties.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chess } from 'chess.js';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import {
  gameLibraryStore,
  gamePlayersTitle,
  gameSubtitle,
  type ImportedChessGame,
} from '@/lib/gameLibrary';
import {
  createChessWorkspaceSession,
} from '@/lib/workspace/WorkspaceSessionRegistry';
import type { ChessWorkspacePayload } from '@/lib/workspace/types';

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function validateFen(fen: string): { ok: boolean; error?: string } {
  try {
    new Chess(fen);
    return { ok: true };
  } catch {
    return { ok: false, error: 'FEN invalide.' };
  }
}

export default function PartiesLibraryScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useAppSafeInsets();
  const router = useRouter();
  const [games, setGames] = useState<ImportedChessGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fenInput, setFenInput] = useState('');
  const [fenError, setFenError] = useState<string | null>(null);
  const [fenExpanded, setFenExpanded] = useState(false);

  const reload = useCallback(async () => {
    const list = await gameLibraryStore.listGames();
    setGames(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onImport = async () => {
    setImporting(true);
    setStatus(null);
    try {
      const picked = await pickPgnFile();
      if (!picked) {
        setImporting(false);
        return;
      }
      const result = await gameLibraryStore.importPgnText(picked.text, picked.filename);
      await reload();
      const parts: string[] = [];
      if (result.imported.length > 0) {
        parts.push(
          t('parties.importOk', { count: result.imported.length }),
        );
      }
      if (result.skippedDuplicates > 0) {
        parts.push(
          t('parties.importDuplicates', { count: result.skippedDuplicates }),
        );
      }
      if (result.skippedInvalid > 0) {
        parts.push(
          t('parties.importSkipped', { count: result.skippedInvalid }),
        );
      }
      if (result.imported.length === 0 && result.errors[0]) {
        setStatus(result.errors[0]);
      } else {
        setStatus(parts.join(' · ') || t('parties.importNone'));
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('parties.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const onDelete = (game: ImportedChessGame) => {
    Alert.alert(
      t('parties.deleteTitle'),
      gamePlayersTitle(game.headers),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('parties.deleteConfirm'),
          style: 'destructive',
          onPress: () => {
            void gameLibraryStore.deleteGame(game.id).then(reload);
          },
        },
      ],
    );
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

      {/* FEN import */}
      <Pressable
        testID="parties-fen-toggle"
        onPress={() => setFenExpanded((v) => !v)}
        style={[styles.importBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
      >
        <Ionicons name="grid-outline" size={20} color={colors.foreground} />
        <Text style={[styles.importText, { color: colors.foreground }]}>
          Importer une FEN
        </Text>
      </Pressable>
      {fenExpanded && (
        <View style={[styles.fenBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput
            value={fenInput}
            onChangeText={(v) => { setFenInput(v); setFenError(null); }}
            placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.fenInput, { color: colors.foreground, borderColor: colors.border }]}
            autoCapitalize="none"
            autoCorrect={false}
            testID="parties-fen-input"
          />
          {fenError ? (
            <Text style={{ color: '#c44', fontSize: 12 }}>{fenError}</Text>
          ) : null}
          <Pressable
            testID="parties-fen-submit"
            onPress={() => {
              const fen = fenInput.trim() || STANDARD_START_FEN;
              const check = validateFen(fen);
              if (!check.ok) { setFenError(check.error ?? 'FEN invalide.'); return; }
              const sideToMove = fen.split(' ')[1] === 'b' ? 'black' : 'white';
              const payload: ChessWorkspacePayload = {
                schemaVersion: 1,
                workspaceMode: 'free-play',
                source: 'manual-fen',
                title: `FEN — Trait aux ${sideToMove === 'white' ? 'Blancs' : 'Noirs'}`,
                subtitle: fen,
                initialFen: fen,
                moves: [],
                orientation: sideToMove,
                playerColor: sideToMove,
              };
              const sessionId = createChessWorkspaceSession(payload, 'page');
              setFenInput('');
              setFenExpanded(false);
              router.push(`/parties/workspace?sessionId=${sessionId}` as Href);
            }}
            style={[styles.importBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.importText, { color: '#fff' }]}>Ouvrir</Text>
          </Pressable>
        </View>
      )}

      {/* Position initiale */}
      <Pressable
        testID="parties-initial-position"
        onPress={() => {
          const payload: ChessWorkspacePayload = {
            schemaVersion: 1,
            workspaceMode: 'free-play',
            source: 'initial-position',
            title: 'Position initiale',
            subtitle: 'Exploration libre',
            initialFen: STANDARD_START_FEN,
            moves: [],
            orientation: 'white',
            playerColor: 'white',
          };
          const sessionId = createChessWorkspaceSession(payload, 'page');
          router.push(`/parties/workspace?sessionId=${sessionId}` as Href);
        }}
        style={[styles.importBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
      >
        <Ionicons name="game-controller-outline" size={20} color={colors.foreground} />
        <Text style={[styles.importText, { color: colors.foreground }]}>
          Position initiale
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
                onPress={() => router.push(`/parties/${game.id}` as Href)}
                style={styles.cardMain}
              >
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  {gamePlayersTitle(game.headers)}
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
  fenBox: {
    gap: 10,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: 12,
  },
  fenInput: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
