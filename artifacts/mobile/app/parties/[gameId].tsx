/**
 * Lecteur de parties — board / notation / node via useGameReader.
 * Variantes, TTS synchronisé, commandes vocales, handoff Analyseur (nodeId).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { SharedGameReaderView } from '@/components/gameReader';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import {
  gameLibraryStore,
  gamePlayersTitle,
  gameSubtitle,
  type ImportedChessGame,
} from '@/lib/gameLibrary';
import {
  createReaderPlayback,
  loadSharedReaderPosition,
  parseReaderVoiceCommand,
  readerGameFromImported,
  saveSharedReaderPosition,
  useGameReader,
  type GameReaderApi,
} from '@/lib/gameReader';
import { speechService } from '@/services/SpeechService';
import { useSpeechInput } from '@/services/SpeechRecognitionService';

const READER_RESERVED_CHROME = 300;

function orientationFromGame(game: ImportedChessGame): 'white' | 'black' | null {
  const extra = game.headers as ImportedChessGame['headers'] & {
    orientation?: string;
    Orientation?: string;
  };
  const rawHeader = extra.orientation ?? extra.Orientation;
  if (typeof rawHeader === 'string') {
    const v = rawHeader.trim().toLowerCase();
    if (v === 'black' || v === 'b') return 'black';
    if (v === 'white' || v === 'w') return 'white';
  }
  const pgn = game.source.rawPgn;
  if (!pgn) return null;
  const match = /\[Orientation\s+"?(white|black)"?\]/i.exec(pgn);
  if (!match?.[1]) return null;
  return match[1].toLowerCase() === 'black' ? 'black' : 'white';
}

export default function GameReaderScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  useCancelSpeechOnLeave();

  const { dictationPace, voiceEnabled } = usePreferences();
  const [voiceActive, setVoiceActive] = useState(false);
  const syncFromVoiceRef = useRef(false);
  const readerRef = useRef<GameReaderApi | null>(null);
  const playbackRef = useRef(
    createReaderPlayback({
      pace: dictationPace,
      speakAndWait: (text) => speechService.speakAndWait(text),
      cancelSpeech: (reason) => speechService.cancel(reason),
    }),
  );

  const [game, setGame] = useState<ImportedChessGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardVisible, setBoardVisible] = useState(true);
  const [movesVisible, setMovesVisible] = useState(true);
  const [restoreNodeId, setRestoreNodeId] = useState<string | null>(null);
  const [restoreFlipped, setRestoreFlipped] = useState<boolean | null>(null);

  useEffect(() => {
    return () => {
      playbackRef.current.cancel('unmount-reader');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!gameId) {
        setLoading(false);
        return;
      }
      const loaded = await gameLibraryStore.getGame(String(gameId));
      if (!cancelled) {
        setGame(loaded);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    setBoardVisible(true);
    setMovesVisible(true);
  }, [gameId]);

  useFocusEffect(
    useCallback(() => {
      if (!gameId) return;
      const shared = loadSharedReaderPosition(String(gameId));
      if (!shared) return;
      setRestoreNodeId(shared.nodeId);
      setRestoreFlipped(shared.boardFlipped);
    }, [gameId]),
  );

  const boardOrientation = (game ? orientationFromGame(game) : null) ?? 'white';

  const readerGame = useMemo(() => {
    if (!game) return null;
    return readerGameFromImported({
      id: game.id,
      fingerprint: game.fingerprint,
      headers: game.headers,
      initialFen: game.initialFen,
      moves: game.moves,
      hasVariations: game.hasVariations,
      rawPgn: game.source.rawPgn,
      source: game.source,
    });
  }, [game]);

  const reader = useGameReader({
    game: readerGame,
    initialNodeId: restoreNodeId,
    initialFlipped:
      restoreFlipped != null ? restoreFlipped : boardOrientation === 'black',
  });
  readerRef.current = reader;

  const stopVoice = useCallback((reason: string) => {
    playbackRef.current.cancel(reason);
    setVoiceActive(false);
  }, []);

  const startVoiceFromCurrent = useCallback(
    (api: GameReaderApi) => {
      if (!voiceEnabled) return;
      setVoiceActive(true);
      const handle = playbackRef.current.playFrom(
        api.game,
        api.currentNodeId,
        (nodeId) => {
          syncFromVoiceRef.current = true;
          api.goToNode(nodeId);
          syncFromVoiceRef.current = false;
        },
      );
      void handle.done.finally(() => setVoiceActive(false));
    },
    [voiceEnabled],
  );

  const applyVoiceCommand = useCallback(
    (text: string, api: GameReaderApi) => {
      const cmd = parseReaderVoiceCommand(text);
      if (!cmd) return;
      switch (cmd.type) {
        case 'pause':
          stopVoice('voice-pause');
          break;
        case 'continue':
          startVoiceFromCurrent(api);
          break;
        case 'restart':
          stopVoice('voice-restart');
          syncFromVoiceRef.current = true;
          api.goToStart();
          syncFromVoiceRef.current = false;
          startVoiceFromCurrent(api);
          break;
        case 'nextMove':
          stopVoice('voice-next');
          api.goToNext();
          break;
        case 'previousMove':
          stopVoice('voice-prev');
          api.goToPrevious();
          break;
        case 'repeatMoves':
          playbackRef.current.cancel('voice-repeat-moves');
          playbackRef.current.repeatMovesAudio(
            api.game,
            api.currentNodeId,
            cmd.count,
            cmd.repetitions,
          );
          break;
        case 'repeatAll':
          // Active line complete (variation-aware), audio only.
          playbackRef.current.cancel('voice-repeat-all');
          playbackRef.current.repeatAllAudio(api.game, api.currentNodeId);
          break;
        default:
          break;
      }
    },
    [startVoiceFromCurrent, stopVoice],
  );

  const { micActive, toggleMic } = useSpeechInput({
    isSpeaking: voiceActive || speechService.isSpeaking,
    onTranscript: (text) => {
      const api = readerRef.current;
      if (!api) return;
      applyVoiceCommand(text, api);
    },
  });

  const readerForView = useMemo(() => {
    if (!reader) return null;
    const wrap =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (!syncFromVoiceRef.current) stopVoice('manual-nav');
        fn(...args);
      };
    return {
      ...reader,
      goToStart: wrap(reader.goToStart),
      goToPrevious: wrap(reader.goToPrevious),
      goToNext: wrap(reader.goToNext),
      goToEnd: wrap(reader.goToEnd),
      goToPly: wrap(reader.goToPly),
      goToNode: wrap(reader.goToNode),
    };
  }, [reader, stopVoice]);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    const reserved =
      READER_RESERVED_CHROME +
      contentTop +
      contentBottom +
      (boardVisible ? 0 : -120) +
      (movesVisible ? 0 : -80);
    return fitBoardSizeToViewport(wide, windowHeight, Math.max(220, reserved));
  }, [
    windowWidth,
    windowHeight,
    contentTop,
    contentBottom,
    boardVisible,
    movesVisible,
  ]);

  if (loading) {
    return (
      <ChessScreenScaffold
        title={t('parties.reader')}
        onBack={() => router.back()}
        testID="game-reader-loading"
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground }}>{t('parties.loading')}</Text>
      </ChessScreenScaffold>
    );
  }

  if (!game) {
    return (
      <ChessScreenScaffold
        title={t('parties.reader')}
        onBack={() => router.back()}
        testID="game-reader-missing"
      >
        <Text style={{ color: colors.foreground }}>{t('parties.notFound')}</Text>
        <Pressable onPress={() => router.replace('/parties' as Href)}>
          <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
        </Pressable>
      </ChessScreenScaffold>
    );
  }

  if (!reader || !readerForView) {
    return (
      <ChessScreenScaffold
        title={t('parties.reader')}
        subtitle={t('parties.parseError')}
        onBack={() => router.back()}
        testID="game-reader-parse-error"
      >
        <Text style={{ color: colors.foreground, textAlign: 'center' }}>
          {t('parties.parseError')}
        </Text>
        <Pressable onPress={() => router.replace('/parties' as Href)}>
          <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
        </Pressable>
      </ChessScreenScaffold>
    );
  }

  const title = gamePlayersTitle(game.headers);
  const subtitle = gameSubtitle(game);
  const result = game.headers.result ?? '*';

  return (
    <ChessScreenScaffold
      title={title}
      subtitle={subtitle || t('parties.reader')}
      onBack={() => {
        stopVoice('leave-reader');
        router.back();
      }}
      testID="game-reader"
      trailing={
        <Pressable
          testID="parties-open-analyzer-from-reader"
          accessibilityRole="button"
          accessibilityLabel={t('parties.openAnalyzer')}
          onPress={() => {
            stopVoice('open-analyzer');
            saveSharedReaderPosition({
              gameId: game.id,
              nodeId: reader.currentNodeId,
              fen: reader.currentFen,
              boardFlipped: reader.boardFlipped,
              activeLineNodeIds: reader.activeLineNodeIds,
            });
            router.push({
              pathname: '/parties/analyzer',
              params: {
                gameId: game.id,
                nodeId: reader.currentNodeId ?? '',
                flipped: reader.boardFlipped ? '1' : '0',
              },
            });
          }}
          style={[
            styles.headerChip,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Text style={[styles.headerChipLabel, { color: colors.foreground }]}>
            {t('parties.analyzer')}
          </Text>
        </Pressable>
      }
    >
      <View style={styles.toggles}>
        <BoardVisibilityToggle
          visible={boardVisible}
          onToggle={() => setBoardVisible(!boardVisible)}
        />
        <BoardCoordinatesToggle
          visible={showCoordinates}
          onToggle={() => void toggleCoordinates()}
        />
        <Pressable
          testID="game-reader-toggle-moves"
          onPress={() => setMovesVisible(!movesVisible)}
          style={[styles.movesToggle, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.foreground, fontSize: 12 }}>
            {movesVisible ? t('parties.hideMoves') : t('parties.showMoves')}
          </Text>
        </Pressable>
      </View>

      <SharedGameReaderView
        reader={readerForView}
        boardSize={boardSize}
        showCoordinates={showCoordinates}
        showBoard={boardVisible}
        showNotation={movesVisible}
        showToolbar
        toolbar={{
          voiceActive,
          onToggleVoice: () => {
            if (voiceActive) {
              stopVoice('pause');
              return;
            }
            startVoiceFromCurrent(reader);
          },
          onRepeat: () => {
            playbackRef.current.cancel('repeat');
            playbackRef.current.repeatMovesAudio(
              reader.game,
              reader.currentNodeId,
              1,
              1,
            );
          },
          micActive,
          onToggleMic: toggleMic,
          micDisabled: false,
        }}
        bottomSlot={
          reader.currentPly >= reader.totalPly && reader.totalPly > 0 ? (
            <View style={styles.endBlock} testID="game-reader-ended">
              <Text style={[styles.endText, { color: colors.foreground }]}>
                {t('parties.endOfGame', { result })}
              </Text>
              <Pressable
                onPress={() => reader.goToStart()}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>{t('common.restart')}</Text>
              </Pressable>
              <Pressable onPress={() => router.replace('/parties' as Href)}>
                <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerChipLabel: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    width: '100%',
  },
  movesToggle: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  endBlock: { alignItems: 'center', gap: 10, width: '100%' },
  endText: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
