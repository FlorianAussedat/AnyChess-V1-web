import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
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
import { TheoryContinuationViewer } from '@/components/TheoryContinuationViewer';
import { GameActionRow } from '@/components/game/GameActionRow';
import { GameSidePicker } from '@/components/game/GameSidePicker';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameExportPgnModal } from '@/components/game/GameExportPgnModal';
import { useOpeningGame } from '@/contexts/OpeningGameContext';
import type { PlayerColor, SideChoice } from '@/lib/game/types';
import { pairMoveHistory, resolveSideChoice } from '@/lib/game';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';

export function OpeningGameScreen() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const router = useRouter();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
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
    changeColor,
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
  const gameStarted = history.length > 0;
  const [pendingSide, setPendingSide] = useState<SideChoice>(() =>
    playerColor === 'b' ? 'b' : 'w',
  );
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
      applySide(resolveSideChoice(side));
    },
    [gameStarted, applySide],
  );

  const onNewGamePress = useCallback(() => {
    if (pendingSide === 'random') applySide(resolveSideChoice('random'));
    else if (pendingSide !== playerColor) changeColor(pendingSide);
    else newGame();
  }, [pendingSide, playerColor, applySide, changeColor, newGame]);

  const moveRows = pairMoveHistory(history);

  if (loadError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
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
            paddingTop: topPad + 6,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: 'Inter_400Regular' }}>
          Chargement du répertoire…
        </Text>
      </View>
    );
  }

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
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {repertoireName}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {playerColor === 'w' ? 'Tu joues les Blancs' : 'Tu joues les Noirs'}
              {' · '}
              {phase === 'book' ? 'Théorie' : 'Stockfish'}
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

      {theoryExit && (
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
            {theoryExit.message}
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
                Voir la ligne théorique
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <GameActionRow
        onRepeat={repeatLast}
        onUndo={undoMove}
        onSummarize={summarizeGame}
        onNewGame={onNewGamePress}
      />

      {!gameStarted ? (
        <GameSidePicker pendingSide={pendingSide} onPickSide={onPickSide} />
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
        thinkingLabel={phase === 'book' ? 'Répertoire…' : "L'adversaire réfléchit…"}
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
        placeholder="Ex. e4, Cf3, petit roque…"
        testID="opening-manual-input"
      />

      <GameMoveHistoryCard
        moveRows={moveRows}
        opening={openingIdentity}
        emptyMessage="L’adversaire suit ton répertoire"
        onExportPress={() => {
          setExportedText(exportPgn());
          setExportOpen(true);
        }}
        exportMode="text"
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 10, gap: 7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, marginRight: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
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
  theoryBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  theoryText: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  boardRow: { alignItems: 'center' },
  errorText: { marginTop: 24, fontFamily: 'Inter_500Medium', fontSize: 14, paddingHorizontal: 8 },
});
