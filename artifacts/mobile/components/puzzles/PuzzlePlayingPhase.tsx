import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { BoardToolbar } from '@/components/BoardToolbar';
import { GameMicButton } from '@/components/game/GameMicButton';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useBoardSize } from '@/hooks/useBoardSize';

export function PuzzlePlayingPhase() {
  const colors = useColors();
  const { soundEnabled } = useAudioSettings();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const wideBoardSize = useBoardSize('wide');
  const {
    phase,
    submode,
    puzzle,
    displayBoard,
    lastMove,
    orientation,
    boardVisible,
    whitePiecesShown,
    blackPiecesShown,
    isPreviewing,
    isReplaying,
    isSpeaking,
    lastFeedback,
    solutionLine,
    nextMoveHint,
    positionNarration,
    sideToMove,
    currentStreak,
    getLegalDestinations,
    attemptBoardMove,
    applySpokenMove,
    revealSolution,
    revealNextMove,
    revealWhitePieces,
    revealBlackPieces,
    repeatPosition,
    backToHub,
  } = usePuzzle();

  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  const submitSpoken = useCallback(
    (text: string) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      const r = applySpokenMove(text);
      if (r === 'correct' || r === 'complete') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (r === 'wrong-legal' || r === 'illegal') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [applySpokenMove],
  );

  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    enabled: !isReplaying && !isPreviewing,
    forceOff: isReplaying || isPreviewing,
    onTranscript: submitSpoken,
  });

  useEffect(() => {
    setSelected(null);
    setLegalDests([]);
  }, [puzzle?.id, lastMove?.from, lastMove?.to]);

  const onSquarePress = useCallback(
    (square: string) => {
      if (isReplaying || isPreviewing || submode !== 'visual' || !boardVisible) return;
      if (selected === null) {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setSelected(square);
          setLegalDests(dests);
        }
      } else if (square === selected) {
        setSelected(null);
        setLegalDests([]);
      } else if (legalDests.includes(square)) {
        const r = attemptBoardMove(selected, square);
        if (r === 'correct' || r === 'complete') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (r === 'wrong-legal' || r === 'illegal') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setSelected(null);
        setLegalDests([]);
      } else {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setSelected(square);
          setLegalDests(dests);
        } else {
          setSelected(null);
          setLegalDests([]);
        }
      }
    },
    [
      isReplaying,
      isPreviewing,
      submode,
      boardVisible,
      selected,
      legalDests,
      getLegalDestinations,
      attemptBoardMove,
    ],
  );

  const title =
    phase === 'solution-replay'
      ? 'Solution'
      : submode === 'blind'
        ? 'À l’aveugle'
        : 'Visuel';

  const showBoard =
    submode === 'visual' ||
    phase === 'solution-replay' ||
    whitePiecesShown ||
    blackPiecesShown;

  const useWide = submode === 'visual' || phase === 'solution-replay';

  return (
    <ModeScreenShell title={title} onBack={backToHub}>
      <ScrollView
        contentContainerStyle={puzzleStyles.body}
        keyboardShouldPersistTaps="handled"
      >
        {!!puzzle && (
          <Text style={[puzzleStyles.meta, { color: colors.mutedForeground }]}>
            {puzzle.id} · cote {puzzle.rating} (Lichess) ·{' '}
            {sideToMove === 'w' ? 'Trait aux Blancs' : 'Trait aux Noirs'}
            {' · '}
            Série : {currentStreak}
          </Text>
        )}

        {submode === 'blind' && !!positionNarration && (
          <View
            style={[
              puzzleStyles.statusCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="puzzle-blind-narration"
          >
            <Text
              style={{
                color: colors.foreground,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {positionNarration}
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 13,
                marginTop: 6,
              }}
            >
              {sideToMove === 'w' ? 'Trait aux Blancs' : 'Trait aux Noirs'}
            </Text>
          </View>
        )}

        {(submode === 'visual' || phase === 'solution-replay') && (
          <View
            style={[
              puzzleStyles.statusCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
              {lastFeedback ?? (isReplaying ? 'Relecture…' : 'À toi de trouver le coup.')}
            </Text>
            {!!nextMoveHint && !solutionLine && (
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                {nextMoveHint}
              </Text>
            )}
            {!!solutionLine && (
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                {solutionLine}
              </Text>
            )}
          </View>
        )}

        {submode === 'blind' && (!!lastFeedback || !!nextMoveHint) && (
          <Text style={[puzzleStyles.hint, { color: colors.mutedForeground }]}>
            {nextMoveHint ?? lastFeedback}
          </Text>
        )}

        {showBoard && submode === 'visual' && (
          <View
            style={{
              alignItems: 'center',
              gap: 8,
              alignSelf: 'center',
              width: wideBoardSize,
            }}
          >
            <View style={{ width: '100%' }}>
              <BoardToolbar
                label={sideToMove === 'w' ? 'Trait aux Blancs' : 'Trait aux Noirs'}
                showCoordinates={showCoordinates}
                onToggleCoordinates={() => {
                  void toggleCoordinates();
                }}
              />
            </View>
            <ChessBoard
              board={displayBoard}
              lastMove={lastMove}
              isFlipped={orientation === 'b'}
              selectedSquare={selected}
              legalDots={legalDests}
              onSquarePress={onSquarePress}
              showCoordinates={showCoordinates}
              sizeMode="wide"
              size={wideBoardSize}
            />
          </View>
        )}

        {!isReplaying && !isPreviewing && (
          <>
            <ChessAnswerInput
              onSubmit={submitSpoken}
              enabled={!isReplaying && !isPreviewing}
              persistFocus
              placeholder="Ex. Cf3, Fou prend e5, petit roque…"
            />

            <GameMicButton
              showRecognized={showRecognizedFlash}
              isListening={isListening}
              micActive={micActive}
              micMessage={micStatus.message}
              onToggle={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                toggleMic();
              }}
              testID={
                submode === 'blind' ? 'puzzle-blind-mic' : 'puzzle-visual-mic'
              }
            />

            {submode === 'blind' && (
              <>
                <View style={puzzleStyles.compactActionRow}>
                  <Pressable
                    onPress={revealWhitePieces}
                    style={({ pressed }) => [
                      puzzleStyles.compactAction,
                      {
                        borderColor: whitePiecesShown ? colors.primary : colors.border,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    testID="puzzle-reveal-white"
                  >
                    <Ionicons
                      name="eye-outline"
                      size={16}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 12,
                      }}
                    >
                      Pièces blanches
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={revealBlackPieces}
                    style={({ pressed }) => [
                      puzzleStyles.compactAction,
                      {
                        borderColor: blackPiecesShown ? colors.primary : colors.border,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    testID="puzzle-reveal-black"
                  >
                    <Ionicons
                      name="eye-outline"
                      size={16}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 12,
                      }}
                    >
                      Pièces noires
                    </Text>
                  </Pressable>
                </View>
                <View style={puzzleStyles.compactActionRow}>
                  <Pressable
                    onPress={repeatPosition}
                    style={({ pressed }) => [
                      puzzleStyles.compactAction,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    testID="puzzle-repeat-position"
                  >
                    <Ionicons
                      name="volume-medium-outline"
                      size={16}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 12,
                      }}
                    >
                      Répéter
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={revealNextMove}
                    style={({ pressed }) => [
                      puzzleStyles.compactAction,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    testID="puzzle-next-move"
                  >
                    <Ionicons
                      name="arrow-forward-outline"
                      size={16}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 12,
                      }}
                    >
                      Coup suivant
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {submode === 'visual' && (
              <View style={puzzleStyles.compactActionRow}>
                <Pressable
                  onPress={revealNextMove}
                  style={({ pressed }) => [
                    puzzleStyles.compactAction,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  testID="puzzle-next-move"
                >
                  <Ionicons
                    name="arrow-forward-outline"
                    size={16}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 13,
                    }}
                  >
                    Coup suivant
                  </Text>
                </Pressable>
                <Pressable
                  onPress={revealSolution}
                  style={({ pressed }) => [
                    puzzleStyles.compactAction,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  testID="puzzle-solution"
                >
                  <Ionicons
                    name="bulb-outline"
                    size={16}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 13,
                    }}
                  >
                    Solution
                  </Text>
                </Pressable>
              </View>
            )}

            {submode === 'blind' && (
              <Pressable
                onPress={revealSolution}
                style={({ pressed }) => [
                  puzzleStyles.compactAction,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: pressed ? 0.7 : 1,
                    alignSelf: 'stretch',
                  },
                ]}
                testID="puzzle-solution"
              >
                <Ionicons name="bulb-outline" size={16} color={colors.mutedForeground} />
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                  }}
                >
                  Solution
                </Text>
              </Pressable>
            )}
          </>
        )}

        {/* Blind board appears only after an explicit piece reveal */}
        {showBoard && submode === 'blind' && (
          <View
            style={{
              alignItems: 'center',
              gap: 8,
              alignSelf: 'center',
              width: useWide ? wideBoardSize : undefined,
            }}
            testID="puzzle-blind-board"
          >
            <ChessBoard
              board={displayBoard}
              lastMove={lastMove}
              isFlipped={orientation === 'b'}
              selectedSquare={null}
              legalDots={[]}
              onSquarePress={() => {}}
              showCoordinates={false}
              sizeMode={useWide ? 'wide' : 'default'}
              size={useWide ? wideBoardSize : undefined}
            />
          </View>
        )}

        {phase === 'solution-replay' && (
          <View
            style={{
              alignItems: 'center',
              gap: 8,
              alignSelf: 'center',
              width: wideBoardSize,
            }}
          >
            <ChessBoard
              board={displayBoard}
              lastMove={lastMove}
              isFlipped={orientation === 'b'}
              selectedSquare={null}
              legalDots={[]}
              onSquarePress={() => {}}
              showCoordinates={showCoordinates}
              sizeMode="wide"
              size={wideBoardSize}
            />
          </View>
        )}

        {!soundEnabled && (
          <Text style={[puzzleStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Son coupé — relecture visuelle uniquement.
          </Text>
        )}
      </ScrollView>
    </ModeScreenShell>
  );
}
