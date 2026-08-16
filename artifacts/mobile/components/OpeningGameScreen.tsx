import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { OpeningVariationLabel } from '@/components/game/OpeningVariationLabel';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BackButton } from '@/components/BackButton';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { TheoryContinuationViewer } from '@/components/TheoryContinuationViewer';
import { TheoryDecisionPanel } from '@/components/openings/TheoryDecisionPanel';
import { GameActionRow } from '@/components/game/GameActionRow';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameExportPgnModal } from '@/components/game/GameExportPgnModal';
import { useOpeningGame } from '@/contexts/OpeningGameContext';
import { pairMoveHistory } from '@/lib/game';
import { formatSanForDisplay } from '@/lib/chess/notation';
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
    trainingState,
    theoryExit,
    repertoireName,
    openingLabel,
    strengthBandLabel,
    ready,
    loadError,
    applyUserMove,
    movePieceBySquare,
    getLegalDestinations,
    newGame,
    repeatLast,
    summarizeGame,
    undoMove,
    continueVsEngine,
    undoAndThinkAgain,
    showExpectedMove,
    restartLine,
    nextLine,
    exportPgn,
    downloadPgn,
  } = useOpeningGame();

  const openingIdentity = useOpeningIdentity(history);
  const applyRef = useRef(applyUserMove);
  useEffect(() => {
    applyRef.current = applyUserMove;
  }, [applyUserMove]);

  const deciding =
    trainingState === 'lineComplete' || trainingState === 'outOfTheory';
  const canAct = waitingForUser && !isOpponentThinking && !isGameOver && !deciding;
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
    forceOff: isGameOver || deciding,
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
  const phaseLabel =
    trainingState === 'engineContinuation'
      ? t('openings.stockfish')
      : trainingState === 'lineComplete'
        ? t('openings.endOfTheoreticalLine')
        : trainingState === 'outOfTheory'
          ? t('openings.leftTheory')
          : t('openings.theory');
  const headerTitle = repertoireName || t('openings.repertoire');
  const headerSubtitle = `${campLabel} · ${phaseLabel}`;

  const statusText =
    trainingState === 'lineComplete'
      ? t('openings.endOfTheoreticalLine')
      : trainingState === 'outOfTheory'
        ? t('openings.leftTheory')
        : trainingState === 'engineContinuation'
          ? status || t('openings.theoryCompleteContinuing')
          : status;

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
        {!deciding && (
          <GameActionRow
            onRepeat={repeatLast}
            onUndo={undoMove}
            onSummarize={summarizeGame}
            onNewGame={newGame}
          />
        )}

        <OpeningVariationLabel label={openingLabel} />

        {/* Same status + board-toggle row language as Partie classique. */}
        <View style={styles.statusRow} testID="opening-status-row">
          <View style={styles.statusGrow}>
            <GameStatusCard
              status={statusText}
              heardText={heardText}
              isGameOver={isGameOver}
              isOpponentThinking={isOpponentThinking}
              thinkingLabel={
                trainingState === 'playingTheory'
                  ? t('openings.repertoireThinking')
                  : t('game.opponentThinking')
              }
              compact
              testID="opening-coup-banner"
            />
          </View>
          <View style={styles.boardToggles}>
            <BoardCoordinatesToggle
              visible={showCoordinates}
              onToggle={() => {
                void toggleCoordinates();
              }}
            />
            <BoardVisibilityToggle
              visible={boardVisible}
              onToggle={() => setBoardVisible((v) => !v)}
            />
          </View>
        </View>

        <ChessBoardSection boardSize={boardSize} testID="opening-board-block">
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

        <TheoryDecisionPanel
          trainingState={trainingState}
          strengthBandLabel={strengthBandLabel}
          onRestartLine={restartLine}
          onNextLine={nextLine}
          onContinueVsEngine={continueVsEngine}
          onUndoThinkAgain={undoAndThinkAgain}
          onShowExpected={() => {
            const san = showExpectedMove();
            if (san) {
              // Status already set in context; notation preference applied for display.
              void formatSanForDisplay(san, chessNotation);
            }
          }}
          onShowFullLine={() => setTheoryOpen(true)}
        />

        {!deciding && (
          <>
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
          </>
        )}

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
        openingLabel={openingLabel}
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusGrow: { flex: 1, minWidth: 0 },
  boardToggles: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  errorText: { marginTop: 24, fontFamily: 'Inter_500Medium', fontSize: 14, paddingHorizontal: 8 },
});
