/**
 * Lecteur de parties — board / audio playback for one imported game.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { GamePlaybackControls } from '@/components/gameLibrary/GamePlaybackControls';
import { GameReaderMoveList } from '@/components/gameLibrary/GameReaderMoveList';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useColors } from '@/hooks/useColors';
import { useGamePlayback, DICTATION_PACES } from '@/hooks/useGamePlayback';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
} from '@/lib/game/boardSize';
import {
  gameLibraryStore,
  gamePlayersTitle,
  gameSubtitle,
  stripClkTags,
  type ImportedChessGame,
} from '@/lib/gameLibrary';
import type { DictationPace } from '@/lib/preferences/dictationPace';
import type { MessageKey } from '@/lib/i18n';

const PACE_LABEL: Record<DictationPace, MessageKey> = {
  slow: 'settings.paceSlow',
  quiteSlow: 'settings.paceQuiteSlow',
  medium: 'settings.paceMedium',
  quiteFast: 'settings.paceQuiteFast',
  fast: 'settings.paceFast',
};

const READER_RESERVED_CHROME = 360;

export default function GameReaderScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { dictationPace, voiceEnabled } = usePreferences();
  useCancelSpeechOnLeave();

  const [game, setGame] = useState<ImportedChessGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardVisible, setBoardVisible] = useState(true);
  const [movesVisible, setMovesVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!gameId) {
        setLoading(false);
        return;
      }
      const g = await gameLibraryStore.getGame(String(gameId));
      if (!cancelled) {
        setGame(g);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

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

  return (
    <GameReaderBody
      game={game}
      boardVisible={boardVisible}
      setBoardVisible={setBoardVisible}
      movesVisible={movesVisible}
      setMovesVisible={setMovesVisible}
      showCoordinates={showCoordinates}
      toggleCoordinates={toggleCoordinates}
      dictationPace={dictationPace}
      voiceEnabled={voiceEnabled}
      windowWidth={windowWidth}
      windowHeight={windowHeight}
      contentTop={contentTop}
      contentBottom={contentBottom}
    />
  );
}

function GameReaderBody({
  game,
  boardVisible,
  setBoardVisible,
  movesVisible,
  setMovesVisible,
  showCoordinates,
  toggleCoordinates,
  dictationPace,
  voiceEnabled,
  windowWidth,
  windowHeight,
  contentTop,
  contentBottom,
}: {
  game: ImportedChessGame;
  boardVisible: boolean;
  setBoardVisible: (v: boolean) => void;
  movesVisible: boolean;
  setMovesVisible: (v: boolean) => void;
  showCoordinates: boolean;
  toggleCoordinates: () => void;
  dictationPace: DictationPace;
  voiceEnabled: boolean;
  windowWidth: number;
  windowHeight: number;
  contentTop: number;
  contentBottom: number;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const playback = useGamePlayback({
    game,
    initialPace: dictationPace,
    voiceEnabled,
  });

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

  const title = gamePlayersTitle(game.headers);
  const subtitle = gameSubtitle(game);
  const result = game.headers.result ?? '*';

  return (
    <ChessScreenScaffold
      title={title}
      subtitle={subtitle || t('parties.reader')}
      onBack={() => router.back()}
      testID="game-reader"
    >
      {(playback.clocks.white || playback.clocks.black) && boardVisible ? (
        <View style={styles.clocks} testID="game-reader-clocks">
          <Text style={[styles.clockLine, { color: colors.mutedForeground }]}>
            {game.headers.white ?? t('common.white')}
            {playback.clocks.white ? ` · ${playback.clocks.white}` : ''}
          </Text>
          <Text style={[styles.clockLine, { color: colors.mutedForeground }]}>
            {game.headers.black ?? t('common.black')}
            {playback.clocks.black ? ` · ${playback.clocks.black}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.toggles}>
        <BoardVisibilityToggle
          visible={boardVisible}
          onToggle={() => setBoardVisible(!boardVisible)}
        />
        <BoardCoordinatesToggle
          visible={showCoordinates}
          onToggle={toggleCoordinates}
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

      {boardVisible ? (
        <ChessBoardSection boardSize={boardSize}>
          <ChessBoard
            board={playback.board}
            lastMove={playback.lastMove}
            isFlipped={false}
            showCoordinates={showCoordinates}
            sizeMode="wide"
            size={boardSize}
          />
        </ChessBoardSection>
      ) : null}

      <Text
        style={[styles.progress, { color: colors.mutedForeground }]}
        testID="game-reader-progress"
      >
        {t('parties.progress', {
          label: playback.label,
          ply: playback.ply,
          total: playback.snapshot.totalPlies,
        })}
      </Text>

      <GamePlaybackControls
        isPlaying={playback.isPlaying}
        onStart={playback.goStart}
        onPrev={playback.goPrev}
        onTogglePlay={playback.togglePlay}
        onNext={playback.goNext}
        onEnd={playback.goEnd}
        onRepeat={() => void playback.repeatLast()}
        labels={{
          start: t('parties.start'),
          prev: t('parties.prev'),
          play: t('parties.play'),
          pause: t('parties.pause'),
          next: t('parties.next'),
          end: t('parties.end'),
          repeat: t('parties.repeat'),
        }}
      />

      <View style={styles.intervalBlock}>
        <Text style={[styles.intervalLabel, { color: colors.mutedForeground }]}>
          {t('parties.interval')}
        </Text>
        <View style={styles.intervalRow}>
          {DICTATION_PACES.map((pace) => {
            const active = playback.pace === pace;
            return (
              <Pressable
                key={pace}
                testID={`game-reader-pace-${pace}`}
                onPress={() => playback.setPace(pace)}
                style={[
                  styles.paceChip,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? 'rgba(57, 138, 85, 0.2)'
                      : colors.card,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.foreground,
                    fontSize: 11,
                    fontFamily: DesignTokens.typography.weightSemiBold,
                  }}
                >
                  {t(PACE_LABEL[pace])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {playback.ended ? (
        <View style={styles.endBlock} testID="game-reader-ended">
          <Text style={[styles.endText, { color: colors.foreground }]}>
            {t('parties.endOfGame', { result })}
          </Text>
          <Pressable
            onPress={playback.goStart}
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground }}>{t('common.restart')}</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/parties' as Href)}>
            <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
          </Pressable>
        </View>
      ) : null}

      {(() => {
        if (playback.ply < 1) return null;
        const prose = stripClkTags(game.moves[playback.ply - 1]?.comment);
        if (!prose) return null;
        return (
          <Text
            style={[styles.comment, { color: colors.mutedForeground }]}
            testID="game-reader-comment"
          >
            {prose}
          </Text>
        );
      })()}

      {movesVisible ? (
        <GameReaderMoveList
          sans={game.moves.map((m) => m.san)}
          currentPly={playback.ply}
          onSelectPly={playback.jumpTo}
        />
      ) : null}
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  clocks: { gap: 2, width: '100%' },
  clockLine: { fontSize: 13 },
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
  progress: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  intervalBlock: { width: '100%', gap: 6 },
  intervalLabel: { fontSize: 12 },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  paceChip: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  endBlock: { alignItems: 'center', gap: 10, width: '100%' },
  endText: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  comment: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    width: '100%',
    textAlign: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
