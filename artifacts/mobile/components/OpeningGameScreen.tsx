import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useBoardTouchSelection,
  useMoveEventFeedback,
} from '@/hooks/useGameScreenInteraction';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BoardToolbar } from '@/components/BoardToolbar';
import { BackButton } from '@/components/BackButton';
import { TheoryContinuationViewer } from '@/components/TheoryContinuationViewer';
import { GameActionRow } from '@/components/game/GameActionRow';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameExportPgnModal } from '@/components/game/GameExportPgnModal';
import { useOpeningGame } from '@/contexts/OpeningGameContext';
import { pairMoveHistory } from '@/lib/game';
import { formatNumberedSan } from '@/lib/moves/OpeningOpponent';
import { formatNumberedSanForDisplay } from '@/lib/chess/notation';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { fenFromSanHistory } from '@/lib/moveInput/keypadPromotion';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';

export function OpeningGameScreen() {
  const colors = useColors();
  const { contentTop } = useAppSafeInsets();
  const router = useRouter();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { chessNotation } = usePreferences();
  const { t } = useTranslation();
  const boardSize = useBoardSize('wide');
  useCancelSpeechOnLeave('/openings/play');

  const {
    board,
    history,
    status,
    heardText,
    lastMove,
    isGameOver,
    waitingForUser,
    isOpponentThinking,
    playerColor,
    moveEvent,
    isSpeaking,
    phase,
    theoryExit,
    repertoireName,
    ready,
    loadError,
    applyUserMove,
    movePieceBySquare,
    getLegalDestinations,
    newGame,
    repeatLast,
    summarizeGame,
    undoMove,
    exportPgn,
    downloadPgn,
  } = useOpeningGame();

  const openingIdentity = useOpeningIdentity(history);
  const applyRef = useRef(applyUserMove);
  useEffect(() => {
    applyRef.current = applyUserMove;
  }, [applyUserMove]);

  const canAct = waitingForUser && !isOpponentThinking && !isGameOver;
  const [boardVisible, setBoardVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const prevGameOver = useRef(false);

  useEffect(() => {
    if (isGameOver && !prevGameOver.current) {
      setExportOpen(true);
      setExportedText(exportPgn());
    }
    prevGameOver.current = isGameOver;
  }, [isGameOver, exportPgn]);

  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    forceOff: isGameOver,
    onTranscript: (text) => applyRef.current(text),
  });

  const { showRecognized } = useMoveEventFeedback(moveEvent);
  const { touchSelected, legalDests, onSquarePress } = useBoardTouchSelection({
    canAct,
    getLegalDestinations,
    movePieceBySquare,
  });

  const moveRows = pairMoveHistory(history);
  const answerFen = useMemo(() => fenFromSanHistory(history), [history]);
  const campLabel = playerColor === 'w' ? t('common.whites') : t('common.blacks');
  const phaseLabel = phase === 'book' ? t('openings.theory') : t('openings.stockfish');
  const headerTitle = repertoireName || t('openings.repertoire');
  const headerSubtitle = `${campLabel} · ${phaseLabel}`;
  const theoryExitDisplay =
    theoryExit == null
      ? null
      : theoryExit.kind === 'player-deviation'
        ? t('openings.theoryDeviation', {
            move: formatNumberedSanForDisplay(
              formatNumberedSan(theoryExit.ply, theoryExit.san),
              chessNotation,
            ),
          })
        : t('openings.theoryComplete');

  if (loadError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ScreenHeader onBack={() => router.back()} title={t('openings.repertoire')} />
        <Text style={[styles.errorText, { color: colors.destructive }]}>{loadError}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: contentTop,
          },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <View style={styles.loadingBody}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: 'Inter_400Regular' }}>
            {t('openings.loadingRepertoire')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ChessScreenScaffold
        onBack={() => router.back()}
        title={headerTitle}
        subtitle={headerSubtitle}
        showSound
        gap={DesignTokens.chessScreen.sectionGap}
        trailing={
          !boardVisible ? (
            <View
              style={styles.sideIndicator}
              accessibilityLabel={
                playerColor === 'w' ? t('common.whites') : t('common.blacks')
              }
              testID="opening-side-indicator"
            >
              <Image
                source={BrandAssets.logoMark}
                style={styles.sideIndicatorMark}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.sideIndicatorLetter,
                  { color: playerColor === 'w' ? '#F5F5F5' : '#1A1A1A' },
                ]}
              >
                {playerColor === 'w' ? 'B' : 'N'}
              </Text>
            </View>
          ) : null
        }
        testID="opening-game-scroll"
      >
        {theoryExit && theoryExitDisplay && (
          <View
            style={[
              styles.theoryBanner,
              {
                backgroundColor: theoryExit.kind === 'player-deviation' ? '#3A2A10' : colors.card,
                borderColor: theoryExit.kind === 'player-deviation' ? '#F5A623' : colors.border,
              },
            ]}
          >
            <Text style={[styles.theoryText, { color: colors.foreground }]} numberOfLines={2}>
              {theoryExitDisplay}
            </Text>
            {theoryExit.kind === 'player-deviation' && theoryExit.analysis && (
              <Pressable onPress={() => setTheoryOpen(true)} hitSlop={6}>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {t('openings.viewTheoryLine')}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        <GameActionRow
          onRepeat={repeatLast}
          onUndo={undoMove}
          onSummarize={summarizeGame}
          onNewGame={newGame}
        />

        <GameStatusCard
          status={status}
          heardText={heardText}
          isGameOver={isGameOver}
          isOpponentThinking={isOpponentThinking}
          thinkingLabel={
            phase === 'book'
              ? t('openings.repertoireThinking')
              : t('game.opponentThinking')
          }
        />

        <ChessBoardSection
          boardSize={boardSize}
          toolbar={
            <BoardToolbar
              showCoordinates={showCoordinates}
              onToggleCoordinates={() => {
                void toggleCoordinates();
              }}
              boardVisible={boardVisible}
              onToggleBoardVisible={() => setBoardVisible((v) => !v)}
            />
          }
          testID="opening-board-block"
        >
          {boardVisible ? (
            <ChessBoard
              board={board}
              lastMove={lastMove}
              isFlipped={playerColor === 'b'}
              selectedSquare={touchSelected}
              legalDots={legalDests}
              onSquarePress={onSquarePress}
              showCoordinates={showCoordinates}
              sizeMode="wide"
              size={boardSize}
            />
          ) : (
            <HiddenBoardPlaceholder
              onReveal={() => setBoardVisible(true)}
              sizeMode="wide"
              size={boardSize}
            />
          )}
        </ChessBoardSection>

        <GameMicButton
          showRecognized={showRecognized}
          isListening={isListening}
          micActive={micActive}
          micMessage={micStatus.message}
          onToggle={toggleMic}
        />

        <ChessMoveInput
          inputType="chess-move"
          onSubmit={(text) => applyRef.current(text)}
          fen={answerFen}
          enabled={canAct}
          persistFocus={canAct}
          placeholder={t('openings.movePlaceholder')}
          testID="opening-manual-input"
        />

        <GameMoveHistoryCard
          moveRows={moveRows}
          opening={openingIdentity}
          emptyMessage={t('openings.followsRepertoire')}
          onExportPress={() => {
            setExportedText(exportPgn());
            setExportOpen(true);
          }}
          exportMode="text"
        />
      </ChessScreenScaffold>

      <TheoryContinuationViewer
        visible={theoryOpen}
        analysis={theoryExit?.analysis ?? null}
        onClose={() => setTheoryOpen(false)}
      />

      <GameExportPgnModal
        visible={exportOpen}
        body={`Inclut les coups, le résultat, ta couleur, le répertoire${
          theoryExit ? ' et le commentaire de sortie de théorie' : ''
        }.`}
        exportedText={exportedText}
        exportPgn={exportPgn}
        downloadPgn={downloadPgn}
        onClose={() => setExportOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexGrow: 1, paddingHorizontal: DesignTokens.chessScreen.paddingHorizontal, gap: DesignTokens.chessScreen.sectionGap },
  loadingBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sideIndicator: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sideIndicatorMark: {
    ...StyleSheet.absoluteFillObject,
    width: 32,
    height: 32,
    opacity: 0.9,
  },
  sideIndicatorLetter: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightBold,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  theoryBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  theoryText: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  errorText: { marginTop: 24, fontFamily: 'Inter_500Medium', fontSize: 14, paddingHorizontal: 8 },
});
