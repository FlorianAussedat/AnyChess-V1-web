import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useBoardSize } from '@/hooks/useBoardSize';
import {
  useBoardTouchSelection,
  useMoveEventFeedback,
} from '@/hooks/useGameScreenInteraction';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BoardToolbar } from '@/components/BoardToolbar';
import { BoardCampPicker } from '@/components/game/BoardCampPicker';
import { ChessMoveKeypad } from '@/components/game/ChessMoveKeypad';
import { GameActionRow } from '@/components/game/GameActionRow';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameExportPgnModal } from '@/components/game/GameExportPgnModal';
import { StrengthBandSlider } from '@/components/ui/StrengthBandSlider';
import { useGame } from '@/contexts/GameContext';
import type { PlayerColor, SideChoice } from '@/lib/game/types';
import { beginGameFromCampChoice, pairMoveHistory, resolveSideChoice } from '@/lib/game';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';
import {
  DEFAULT_STRENGTH_BAND_ID,
  getStrengthBand,
} from '@/lib/difficulty/StockfishStrengthBands';

export function ClassicGameScreen() {
  const colors = useColors();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const boardSize = useBoardSize('wide');
  useCancelSpeechOnLeave('/classic');

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
  const [setupBandId, setSetupBandId] = useState(strengthBandId || DEFAULT_STRENGTH_BAND_ID);
  const [boardVisible, setBoardVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const [draftMove, setDraftMove] = useState('');
  /** System keyboard fallback (shows ChessAnswerInput). */
  const [useSystemKeyboard, setUseSystemKeyboard] = useState(false);
  /** Show/hide AnyChess keypad when not in system-keyboard mode. */
  const [anyChessKeypadVisible, setAnyChessKeypadVisible] = useState(true);

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
    if (pendingSide === 'random') applySide(resolveSideChoice('random'));
    else if (pendingSide !== playerColor) changeColor(pendingSide);
    else newGame();
  }, [setupBandId, setStrengthBandId, pendingSide, playerColor, applySide, changeColor, newGame]);

  const activeBand = getStrengthBand(setupBandId);
  const campLabel = playerColor === 'w' ? 'Blancs' : 'Noirs';
  const contextLine = campLocked
    ? `${campLabel} · adversaire ${activeBand.label}`
    : 'Configure la partie';

  const moveRows = pairMoveHistory(history);
  const keypadMode = !useSystemKeyboard;

  /** Shared by system-keyboard arrow and keypad auto-submit. */
  const commitTypedMove = useCallback(
    (raw: string, source: 'text' | 'voice' = 'text'): boolean => {
      const trimmed = raw.trim();
      if (!trimmed || !canAct) return false;
      return applyRef.current(trimmed, source);
    },
    [canAct],
  );

  const onKeypadAutoSubmit = useCallback(
    (raw: string) => {
      const played = commitTypedMove(raw, 'text');
      if (played) setDraftMove('');
      // Invalid: keep buffer so the user can backspace/correct.
    },
    [commitTypedMove],
  );

  const onSystemKeyboardSubmit = useCallback(
    (raw: string) => {
      commitTypedMove(raw, 'text');
    },
    [commitTypedMove],
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: contentTop,
          paddingBottom: contentBottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        onBack={() => router.back()}
        title="Partie classique"
        subtitle={contextLine}
        showSound
        trailing={
          campLocked && !boardVisible ? (
            <View
              style={styles.sideIndicator}
              accessibilityLabel={playerColor === 'w' ? 'Blancs' : 'Noirs'}
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
      />

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

          <View style={[styles.boardBlock, { width: boardSize }]}>
            <BoardToolbar
              showCoordinates={showCoordinates}
              onToggleCoordinates={() => {
                void toggleCoordinates();
              }}
              boardVisible={boardVisible}
              onToggleBoardVisible={() => setBoardVisible((v) => !v)}
            />

            <View style={styles.boardRow}>
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
            </View>

            {/* Coup banner glued under the board — fills the former visual gap. */}
            <GameStatusCard
              status={status}
              heardText={heardText}
              isGameOver={isGameOver}
              isOpponentThinking={isOpponentThinking}
              composeText={keypadMode ? draftMove : null}
              compact
              testID="classic-coup-banner"
            />
          </View>

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

            <Pressable
              onPress={() => {
                if (useSystemKeyboard) {
                  setUseSystemKeyboard(false);
                  setAnyChessKeypadVisible(true);
                  return;
                }
                setAnyChessKeypadVisible((v) => !v);
              }}
              accessibilityLabel={
                anyChessKeypadVisible && keypadMode
                  ? 'Masquer le clavier coups d’échecs'
                  : 'Afficher le clavier coups d’échecs'
              }
              testID="classic-keypad-visibility-toggle"
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor:
                    anyChessKeypadVisible && keypadMode ? colors.accent : colors.secondary,
                  borderColor: anyChessKeypadVisible && keypadMode ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={anyChessKeypadVisible && keypadMode ? 'keypad' : 'keypad-outline'}
                size={20}
                color={colors.foreground}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                setUseSystemKeyboard((v) => {
                  const next = !v;
                  if (next) setAnyChessKeypadVisible(false);
                  else setAnyChessKeypadVisible(true);
                  return next;
                });
              }}
              accessibilityLabel={
                useSystemKeyboard
                  ? 'Revenir au clavier coups d’échecs'
                  : 'Utiliser le clavier système'
              }
              testID="classic-keyboard-mode-toggle"
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: useSystemKeyboard ? colors.accent : colors.secondary,
                  borderColor: useSystemKeyboard ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={useSystemKeyboard ? 'keypad-outline' : 'desktop-outline'}
                size={20}
                color={colors.foreground}
              />
            </Pressable>
          </View>

          {useSystemKeyboard ? (
            <ChessAnswerInput
              value={draftMove}
              onChangeText={setDraftMove}
              onSubmit={onSystemKeyboardSubmit}
              enabled={canAct}
              persistFocus={canAct}
              placeholder="Compose ou dicte le coup"
              testID="manual-input"
            />
          ) : null}

          {keypadMode && anyChessKeypadVisible ? (
            <ChessMoveKeypad
              value={draftMove}
              onChangeText={setDraftMove}
              onSubmit={onKeypadAutoSubmit}
              autoSubmit
              compact
              enabled={canAct}
              testID="classic-move-keypad"
            />
          ) : null}

          <GameMoveHistoryCard
            moveRows={moveRows}
            opening={openingIdentity}
            emptyMessage="La partie commence ici"
            onExportPress={() => {
              setExportedText(exportPgn());
              setExportOpen(true);
            }}
            exportMode="icon"
          />
        </>
      )}

      <GameExportPgnModal
        visible={exportOpen}
        body={`Inclut les coups, le résultat, ta couleur, Stockfish${
          openingIdentity ? `, l’ouverture (${openingIdentity.name}) et le code ECO` : ''
        }.`}
        exportedText={exportedText}
        exportPgn={exportPgn}
        downloadPgn={downloadPgn}
        onClose={() => setExportOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 8, gap: 6 },
  setupBlock: { gap: DesignTokens.spacing.md },
  boardBlock: { gap: 4, alignSelf: 'center' },
  boardRow: { alignItems: 'center' },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
