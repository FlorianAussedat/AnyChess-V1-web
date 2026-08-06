import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
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
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useOpeningIdentity } from '@/hooks/useOpeningIdentity';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';

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
  const campLabel = playerColor === 'w' ? 'Blancs' : 'Noirs';
  const phaseLabel = phase === 'book' ? 'Théorie' : 'Stockfish';
  const headerTitle = repertoireName || 'Répertoire';
  const headerSubtitle = `${campLabel} · ${phaseLabel}`;

  if (loadError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <ScreenHeader onBack={() => router.back()} title="Répertoire" />
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
          },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <View style={styles.loadingBody}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: 'Inter_400Regular' }}>
            Chargement du répertoire…
          </Text>
        </View>
      </View>
    );
  }

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
        title={headerTitle}
        subtitle={headerSubtitle}
        showSound
        trailing={
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
        }
      />

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
        onNewGame={newGame}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 10, gap: 8 },
  loadingBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  theoryBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  theoryText: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  errorText: { marginTop: 24, fontFamily: 'Inter_500Medium', fontSize: 14, paddingHorizontal: 8 },
});
