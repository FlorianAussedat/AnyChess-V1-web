import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
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
import { GameActionRow } from '@/components/game/GameActionRow';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameExportPgnModal } from '@/components/game/GameExportPgnModal';
import { OptionChip } from '@/components/ui/OptionChip';
import { useGame } from '@/contexts/GameContext';
import type { PlayerColor, SideChoice } from '@/lib/game/types';
import { pairMoveHistory, resolveSideChoice } from '@/lib/game';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';
import {
  DEFAULT_STRENGTH_BAND_ID,
  STOCKFISH_STRENGTH_BANDS,
} from '@/lib/difficulty/StockfishStrengthBands';

export function ClassicGameScreen() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const router = useRouter();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
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

  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    forceOff: isGameOver || !campLocked,
    onTranscript: (text) => applyRef.current(text),
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
      setPendingSide(side);
      setStrengthBandId(setupBandId);
      applySide(resolveSideChoice(side));
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

  const activeBand =
    STOCKFISH_STRENGTH_BANDS.find((b) => b.id === setupBandId) ??
    STOCKFISH_STRENGTH_BANDS.find((b) => b.id === DEFAULT_STRENGTH_BAND_ID);
  const campLabel = playerColor === 'w' ? 'Blancs' : 'Noirs';
  const contextLine = campLocked
    ? `${campLabel} · adversaire ${activeBand?.label ?? ''}`
    : 'Configure la partie';

  const moveRows = pairMoveHistory(history);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
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
          campLocked ? (
            <View
              style={styles.sideIndicator}
              accessibilityLabel={playerColor === 'w' ? 'Blancs' : 'Noirs'}
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
          <Text style={[styles.setupLabel, { color: colors.mutedForeground }]}>
            Niveau adversaire
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bandRow}
          >
            {STOCKFISH_STRENGTH_BANDS.map((band) => (
              <OptionChip
                key={band.id}
                label={band.label}
                active={setupBandId === band.id}
                onPress={() => onPickSetupBand(band.id)}
              />
            ))}
          </ScrollView>
          <BoardCampPicker onSelect={onPickSide} />
        </View>
      ) : (
        <>
          <GameActionRow
            onRepeat={repeatLast}
            onUndo={undoMove}
            onSummarize={summarizeGame}
            onNewGame={onNewGamePress}
          />

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
              />
            ) : (
              <HiddenBoardPlaceholder onReveal={() => setBoardVisible(true)} />
            )}
          </View>

          <GameStatusCard
            status={status}
            heardText={heardText}
            isGameOver={isGameOver}
            isOpponentThinking={isOpponentThinking}
          />

          <GameMicButton
            showRecognized={showRecognized}
            isListening={isListening}
            micActive={micActive}
            micMessage={micStatus.message}
            onToggle={toggleMic}
          />

          <ChessAnswerInput
            onSubmit={(text) => applyRef.current(text)}
            enabled={canAct}
            persistFocus={canAct}
            placeholder="Ex. Nc3, Fou b5, e4, petit roque, annuler…"
            testID="manual-input"
          />

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
  root: { flexGrow: 1, paddingHorizontal: 10, gap: 8 },
  setupBlock: { gap: DesignTokens.spacing.md },
  setupLabel: {
    fontSize: 11,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bandRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  boardRow: { alignItems: 'center' },
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
