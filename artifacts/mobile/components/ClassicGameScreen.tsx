import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useBoardTouchSelection,
  useMoveEventFeedback,
} from '@/hooks/useGameScreenInteraction';
import { ChessBoard } from '@/components/ChessBoard';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { BoardCampPicker } from '@/components/game/BoardCampPicker';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessKeyboardToggle } from '@/components/game/ChessKeyboardToggle';
import { ChessMoveKeypad } from '@/components/game/ChessMoveKeypad';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { GameActionRow } from '@/components/game/GameActionRow';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameExportPgnModal } from '@/components/game/GameExportPgnModal';
import { StrengthBandSlider } from '@/components/ui/StrengthBandSlider';
import { useGame } from '@/contexts/GameContext';
import type { PlayerColor, SideChoice } from '@/lib/game/types';
import { beginGameFromCampChoice, pairMoveHistory, resolveSideChoice } from '@/lib/game';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
} from '@/lib/game/boardSize';
import { openPgnInAnalyzer } from '@/lib/gameLibrary';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';
import {
  DEFAULT_STRENGTH_BAND_ID,
  getStrengthBand,
} from '@/lib/difficulty/StockfishStrengthBands';
import { useChessInputMode } from '@/hooks/useChessInputMode';
import { fenFromSanHistory } from '@/lib/moveInput/keypadPromotion';
import { preferencesStore } from '@/lib/preferences';

/** Classic input UI: voice/board (classic) vs chess keypad. */
export type ClassicInputMode = 'classic' | 'keypad';

/**
 * Vertical chrome reserved outside the board when fitting to the viewport
 * (header, actions, status, talk row, history peek, gaps, safe areas, nav).
 */
const CLASSIC_BOARD_RESERVED_CHROME = 340;

function preferredStrengthBandId(fallback: string): string {
  return (
    preferencesStore.getPreferences().stockfishStrengthBandId ||
    fallback ||
    DEFAULT_STRENGTH_BAND_ID
  );
}

export function ClassicGameScreen() {
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { chessNotation } = usePreferences();
  const { t } = useTranslation();
  useCancelSpeechOnLeave('/classic');

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      CLASSIC_BOARD_RESERVED_CHROME + contentTop + contentBottom,
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

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
    strengthBandId,
    setStrengthBandId,
    applyUserMove,
    movePieceBySquare,
    getLegalDestinations,
    newGame,
    changeColor,
    repeatLast,
    summarizeGame,
    undoMove,
    retryOpponentMove,
    exportPgn,
    downloadPgn,
  } = useGame();

  const openingIdentity = useOpeningIdentity(history);
  const applyRef = useRef(applyUserMove);
  useEffect(() => {
    applyRef.current = applyUserMove;
  }, [applyUserMove]);

  const canAct = waitingForUser && !isOpponentThinking && !isGameOver;
  const [campLocked, setCampLocked] = useState(false);
  const [pendingSide, setPendingSide] = useState<SideChoice>('w');
  const [setupBandId, setSetupBandId] = useState(() =>
    preferredStrengthBandId(strengthBandId || DEFAULT_STRENGTH_BAND_ID),
  );
  const [boardVisible, setBoardVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const [draftMove, setDraftMove] = useState('');
  const prevGameOver = useRef(false);

  useEffect(() => {
    if (isGameOver && !prevGameOver.current && campLocked) {
      setExportedText(exportPgn());
      setExportOpen(true);
    }
    prevGameOver.current = isGameOver;
  }, [isGameOver, campLocked, exportPgn]);
  /** Single source of truth for Classic vs Keypad input UI — persisted preference. */
  const { inputMode, setChessInputMode, keypadActive } = useChessInputMode();

  // Clear in-progress compose when piece-letter system changes (FR C… ↔ EN N…).
  useEffect(() => {
    setDraftMove('');
  }, [chessNotation]);

  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    forceOff: isGameOver || !campLocked,
    onTranscript: (text) => {
      applyRef.current(text);
    },
  });

  const { showRecognized } = useMoveEventFeedback(moveEvent);
  const { touchSelected, legalDests, onSquarePress } = useBoardTouchSelection({
    canAct: canAct && campLocked,
    getLegalDestinations,
    movePieceBySquare,
  });

  const onPickSetupBand = useCallback(
    (id: string) => {
      if (campLocked) return;
      setSetupBandId(id);
      setStrengthBandId(id);
    },
    [campLocked, setStrengthBandId],
  );

  const applySide = useCallback(
    (color: PlayerColor) => {
      if (color === playerColor) newGame();
      else changeColor(color);
    },
    [playerColor, newGame, changeColor],
  );

  const onPickSide = useCallback(
    (side: SideChoice) => {
      if (campLocked) return;
      const result = beginGameFromCampChoice(side);
      setPendingSide(side);
      setStrengthBandId(setupBandId);
      applySide(result.playerColor);
      setCampLocked(true);
    },
    [campLocked, setupBandId, setStrengthBandId, applySide],
  );

  const onNewGamePress = useCallback(() => {
    setStrengthBandId(setupBandId);
    setDraftMove('');
    if (pendingSide === 'random') applySide(resolveSideChoice('random'));
    else if (pendingSide !== playerColor) changeColor(pendingSide);
    else newGame();
  }, [setupBandId, setStrengthBandId, pendingSide, playerColor, applySide, changeColor, newGame]);

  const activeBand = getStrengthBand(setupBandId);
  const campLabel = playerColor === 'w' ? t('common.whites') : t('common.blacks');
  const contextLine = campLocked
    ? `${campLabel} · adversaire ${activeBand.label}`
    : t('game.configure');

  const moveRows = pairMoveHistory(history);

  const commitTypedMove = useCallback(
    (raw: string, source: 'text' | 'voice' = 'text'): boolean => {
      const trimmed = raw.trim();
      if (!trimmed || !canAct) return false;
      return applyRef.current(trimmed, source);
    },
    [canAct],
  );

  const keypadFen = useMemo(() => fenFromSanHistory(history), [history]);

  const onKeypadAutoSubmit = useCallback(
    (raw: string) => {
      const played = commitTypedMove(raw, 'text');
      if (played) setDraftMove('');
      // Invalid: keep buffer so the user can backspace/correct.
    },
    [commitTypedMove],
  );

  const toggleInputMode = useCallback(() => {
    void setChessInputMode(inputMode === 'classic' ? 'keypad' : 'classic');
  }, [inputMode, setChessInputMode]);

  return (
    <>
      <ChessScreenScaffold
        onBack={() => router.back()}
        title={t('modes.classic.title')}
        subtitle={contextLine}
        showSound
        trailing={
          campLocked && !boardVisible ? (
            <View
              style={styles.sideIndicator}
              accessibilityLabel={
                playerColor === 'w' ? t('common.whites') : t('common.blacks')
              }
              testID="classic-side-indicator"
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
        testID="classic-game-scroll"
      >
        {!campLocked ? (
          <View style={styles.setupBlock}>
            <StrengthBandSlider bandId={setupBandId} onBandIdChange={onPickSetupBand} />
            <BoardCampPicker onSelect={onPickSide} sizeMode="wide" />
          </View>
        ) : (
          <>
            <GameActionRow
              onRepeat={repeatLast}
              onUndo={undoMove}
              onSummarize={summarizeGame}
              onNewGame={onNewGamePress}
            />

            {/* Status + board toggles (Canva: same row, above the board). */}
            <View style={styles.statusRow} testID="classic-status-row">
              <View style={styles.statusGrow}>
                <GameStatusCard
                  status={status}
                  heardText={heardText}
                  isGameOver={isGameOver}
                  isOpponentThinking={isOpponentThinking}
                  thinkingLabel={t('game.opponentThinking')}
                  composeText={keypadActive ? draftMove : null}
                  compact
                  onRetryOpponent={retryOpponentMove}
                  testID="classic-coup-banner"
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

            <ChessBoardSection boardSize={boardSize} testID="classic-board-block">
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

            {/*
              Keypad mode: BOARD → KEYPAD → TALK+TOGGLE → HISTORY
              Classic mode: BOARD → TALK+TOGGLE → HISTORY
              Board position stays stable; keypad inserts below it.
            */}
            {keypadActive ? (
              <ChessMoveKeypad
                value={draftMove}
                onChangeText={setDraftMove}
                onSubmit={onKeypadAutoSubmit}
                autoSubmit
                fen={keypadFen}
                compact
                enabled={canAct}
                testID="classic-move-keypad"
              />
            ) : null}

            <View style={styles.commandRow} testID="classic-command-row">
              <GameMicButton
                showRecognized={showRecognized}
                isListening={isListening}
                micActive={micActive}
                micMessage={micStatus.message}
                onToggle={toggleMic}
                testID="classic-mic"
                variant="compact"
              />
              <ChessKeyboardToggle
                active={keypadActive}
                onToggle={toggleInputMode}
                variant="classic"
                testID="classic-input-mode-toggle"
              />
            </View>

            <GameMoveHistoryCard
              moveRows={moveRows}
              opening={openingIdentity}
              emptyMessage={t('game.startsHere')}
              onExportPress={() => {
                setExportedText(exportPgn());
                setExportOpen(true);
              }}
              exportMode="icon"
            />
          </>
        )}
      </ChessScreenScaffold>

      <GameExportPgnModal
        visible={exportOpen}
        body={`Inclut les coups, le résultat, ta couleur, Stockfish${
          openingIdentity ? `, l’ouverture (${openingIdentity.name}) et le code ECO` : ''
        }. Analyse ouvre la partie dans le Lecteur + Analyseur.`}
        exportedText={exportedText}
        exportPgn={exportPgn}
        downloadPgn={downloadPgn}
        onClose={() => setExportOpen(false)}
        onOpenInAnalyzer={async () => {
          const opened = await openPgnInAnalyzer({
            pgnText: exportedText || exportPgn(),
            fileName: 'partie-classique.pgn',
            displayName: openingIdentity?.name || 'Partie classique',
            flipped: playerColor === 'b',
            tab: 'analysis',
          });
          if (!opened) return;
          router.push(opened.href);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  setupBlock: { gap: DesignTokens.spacing.md },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusGrow: { flex: 1, minWidth: 0 },
  boardToggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
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
});
