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
import {
  useBoardTouchSelection,
  useMoveEventFeedback,
} from '@/hooks/useGameScreenInteraction';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { SoundToggle } from '@/components/SoundToggle';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { GameActionRow } from '@/components/game/GameActionRow';
import { GameSidePicker } from '@/components/game/GameSidePicker';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameExportPgnModal } from '@/components/game/GameExportPgnModal';
import { useGame } from '@/contexts/GameContext';
import type { PlayerColor } from '@/lib/game/types';
import type { SideChoice } from '@/lib/game/types';
import { pairMoveHistory, resolveSideChoice } from '@/lib/game';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';
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
  const gameStarted = history.length > 0;
  const [pendingSide, setPendingSide] = useState<SideChoice>(() =>
    playerColor === 'b' ? 'b' : 'w',
  );
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
    forceOff: isGameOver,
    onTranscript: (text) => applyRef.current(text),
  });

  const { showRecognized } = useMoveEventFeedback(moveEvent);
  const { touchSelected, legalDests, onSquarePress } = useBoardTouchSelection({
    canAct,
    getLegalDestinations,
    movePieceBySquare,
  });

  const onPickSetupBand = useCallback(
    (id: string) => {
      if (gameStarted) return;
      setSetupBandId(id);
      setStrengthBandId(id);
    },
    [gameStarted, setStrengthBandId],
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
      if (gameStarted) return;
      setPendingSide(side);
      setStrengthBandId(setupBandId);
      applySide(resolveSideChoice(side));
    },
    [gameStarted, setupBandId, setStrengthBandId, applySide],
  );

  const onNewGamePress = useCallback(() => {
    setStrengthBandId(setupBandId);
    if (pendingSide === 'random') applySide(resolveSideChoice('random'));
    else if (pendingSide !== playerColor) changeColor(pendingSide);
    else newGame();
  }, [setupBandId, setStrengthBandId, pendingSide, playerColor, applySide, changeColor, newGame]);

  const moveRows = pairMoveHistory(history);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            testID="back-btn"
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Image source={require('@/assets/images/icon.png')} style={styles.logoImg} />
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Partie classique</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {playerColor === 'w' ? 'Tu joues les Blancs' : 'Tu joues les Noirs'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {gameStarted && (
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
          )}
          <SoundToggle />
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

      <GameActionRow
        onRepeat={repeatLast}
        onUndo={undoMove}
        onSummarize={summarizeGame}
        onNewGame={onNewGamePress}
      />

      {!gameStarted ? (
        <GameSidePicker pendingSide={pendingSide} onPickSide={onPickSide}>
          <Text style={[styles.setupLabel, { color: colors.mutedForeground }]}>
            Niveau adversaire
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bandRow}
          >
            {STOCKFISH_STRENGTH_BANDS.map((band) => {
              const active = setupBandId === band.id;
              return (
                <Pressable
                  key={band.id}
                  onPress={() => onPickSetupBand(band.id)}
                  style={[
                    styles.bandChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 11,
                      color: active ? colors.primaryForeground : colors.foreground,
                    }}
                  >
                    {band.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </GameSidePicker>
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 10, gap: 7 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: 36, height: 36, borderRadius: 8 },
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
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  setupLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bandRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  bandChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  boardRow: { alignItems: 'center' },
});
