/**
 * Analyseur — même cœur Lecteur (`useGameReader`), sans Stockfish.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { SharedGameReaderView } from '@/components/gameReader';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import { gameLibraryStore } from '@/lib/gameLibrary';
import {
  parseReaderPgn,
  readerGameFromImported,
  useGameReader,
  type ReaderGame,
} from '@/lib/gameReader';

const ANALYZER_RESERVED_CHROME = 320;

const SAMPLE_PGN = `[Event "Sample"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 {Ruy Lopez} 4. Ba4 Nf6 *`;

export default function GameAnalyzerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId?: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates } = useBoardCoordinates();

  const [pgnDraft, setPgnDraft] = useState(SAMPLE_PGN);
  const [game, setGame] = useState<ReaderGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fenProbe, setFenProbe] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    void (async () => {
      const imported = await gameLibraryStore.getGame(gameId);
      if (cancelled || !imported) return;
      setPgnDraft(imported.source.rawPgn?.trim() || SAMPLE_PGN);
      setError(null);
      setGame(
        readerGameFromImported({
          id: imported.id,
          fingerprint: imported.fingerprint,
          headers: imported.headers,
          initialFen: imported.initialFen,
          moves: imported.moves,
          hasVariations: imported.hasVariations,
          rawPgn: imported.source.rawPgn,
          source: imported.source,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const onFenChange = useCallback((fen: string, ply: number) => {
    setFenProbe(`${ply}: ${fen}`);
  }, []);

  const reader = useGameReader({
    game,
    onFenChange,
  });

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      Math.max(220, ANALYZER_RESERVED_CHROME + contentTop + contentBottom),
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  const onLoad = () => {
    const result = parseReaderPgn(pgnDraft, { allowEmptyMoves: true });
    if (!result.ok) {
      setGame(null);
      setError(result.detail ? `${result.error} ${result.detail}` : result.error);
      return;
    }
    setError(null);
    setGame(result.game);
  };

  return (
    <ChessScreenScaffold
      title={t('parties.analyzer')}
      subtitle={t('parties.analyzerSubtitle')}
      onBack={() => router.back()}
      testID="game-analyzer"
    >
      <TextInput
        testID="game-analyzer-pgn-input"
        value={pgnDraft}
        onChangeText={setPgnDraft}
        multiline
        placeholder={t('parties.analyzerPaste')}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        testID="game-analyzer-load"
        onPress={onLoad}
        style={({ pressed }) => [
          styles.loadBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.loadText}>{t('parties.analyzerLoad')}</Text>
      </Pressable>

      {error ? (
        <Text style={styles.error} testID="game-analyzer-error">
          {error}
        </Text>
      ) : null}

      {!game ? (
        <Text
          style={[styles.empty, { color: colors.mutedForeground }]}
          testID="game-analyzer-empty"
        >
          {t('parties.analyzerEmpty')}
        </Text>
      ) : reader ? (
        <View style={styles.readerWrap}>
          <SharedGameReaderView
            reader={reader}
            boardSize={boardSize}
            showCoordinates={showCoordinates}
            showPlayers
            showNotation
          />
          {fenProbe ? (
            <Text
              style={[styles.fenProbe, { color: colors.mutedForeground }]}
              testID="game-analyzer-fen"
              numberOfLines={2}
            >
              FEN · {fenProbe}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    minHeight: 110,
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  loadBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: DesignTokens.radius.md,
  },
  loadText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  error: {
    color: '#c44',
    fontSize: 13,
    lineHeight: 18,
    width: '100%',
    textAlign: 'center',
  },
  empty: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  readerWrap: { width: '100%', gap: 8, alignItems: 'center' },
  fenProbe: {
    fontSize: 11,
    width: '100%',
    textAlign: 'center',
  },
});
