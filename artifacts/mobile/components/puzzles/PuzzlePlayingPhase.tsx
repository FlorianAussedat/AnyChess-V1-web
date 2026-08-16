import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { BoardToolbar } from '@/components/BoardToolbar';
import { GameMicButton } from '@/components/game/GameMicButton';
import { MoveFeedbackBanner } from '@/components/feedback/MoveFeedbackBanner';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useMoveFeedback } from '@/hooks/useMoveFeedback';
import { usePreferences } from '@/hooks/usePreferences';
import { triggerHaptic } from '@/lib/feedback/haptics';
import { formatSanLineForDisplay } from '@/lib/chess/notation';

export function PuzzlePlayingPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const { soundEnabled } = useAudioSettings();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { chessNotation } = usePreferences();
  const wideBoardSize = useBoardSize('wide');
  const feedback = useMoveFeedback();
  const submittingRef = useRef(false);
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
    currentFen,
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

  const applyResultFeedback = useCallback(
    (r: string) => {
      if (r === 'correct' || r === 'complete') {
        feedback.signalCorrect(
          r === 'complete' ? t('puzzle.solved') : t('common.correct'),
        );
      } else if (r === 'wrong-legal' || r === 'illegal') {
        feedback.signalIncorrect(t('puzzle.incorrect'));
      } else if (r === 'recognition-failure') {
        feedback.signalInvalid();
      }
    },
    [feedback, t],
  );

  const submitSpoken = useCallback(
    (text: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      try {
        setShowRecognizedFlash(true);
        setTimeout(() => setShowRecognizedFlash(false), 900);
        feedback.onNextAttempt();
        const r = applySpokenMove(text);
        applyResultFeedback(r);
      } finally {
        submittingRef.current = false;
      }
    },
    [applySpokenMove, applyResultFeedback, feedback],
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
    feedback.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on puzzle change only
  }, [puzzle?.id]);

  const onSquarePress = useCallback(
    (square: string) => {
      if (
        isReplaying ||
        isPreviewing ||
        submode !== 'visual' ||
        !boardVisible ||
        submittingRef.current
      ) {
        return;
      }
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
        submittingRef.current = true;
        try {
          feedback.onNextAttempt();
          const r = attemptBoardMove(selected, square);
          applyResultFeedback(r);
          setSelected(null);
          setLegalDests([]);
        } finally {
          submittingRef.current = false;
        }
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
      applyResultFeedback,
      feedback,
    ],
  );

  const title =
    phase === 'solution-replay'
      ? t('puzzle.solution')
      : submode === 'blind'
        ? t('puzzle.blind')
        : t('puzzle.visual');

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
            {t('puzzle.meta', {
              id: puzzle.id,
              rating: puzzle.rating,
              side: sideToMove === 'w' ? t('puzzle.sideWhite') : t('puzzle.sideBlack'),
              streak: currentStreak,
            })}
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
              {sideToMove === 'w' ? t('puzzle.sideWhite') : t('puzzle.sideBlack')}
            </Text>
          </View>
        )}

        {/* Shared Correct / incorrect banner */}
        <MoveFeedbackBanner state={feedback.state} testID="puzzle-move-feedback" />

        {(submode === 'visual' || phase === 'solution-replay') && (
          <View
            style={[
              puzzleStyles.statusCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
              {feedback.state.kind === 'idle'
                ? (lastFeedback ?? (isReplaying ? t('puzzle.replaying') : t('puzzle.findMove')))
                : (feedback.state.message ??
                  (feedback.state.kind === 'correct'
                    ? t('common.correct')
                    : t('common.incorrect')))}
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
                {formatSanLineForDisplay(solutionLine, chessNotation)}
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
          <ChessBoardSection
            boardSize={wideBoardSize}
            style={{ gap: 8 }}
            toolbar={
              <View style={{ width: '100%' }}>
                <BoardToolbar
                  label={sideToMove === 'w' ? t('puzzle.sideWhite') : t('puzzle.sideBlack')}
                  showCoordinates={showCoordinates}
                  onToggleCoordinates={() => {
                    void toggleCoordinates();
                  }}
                />
              </View>
            }
            testID="puzzle-board-block"
          >
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
          </ChessBoardSection>
        )}

        {!isReplaying && !isPreviewing && (
          <>
            <ChessMoveInput
              inputType="chess-move"
              onSubmit={submitSpoken}
              fen={currentFen}
              enabled={!isReplaying && !isPreviewing}
              persistFocus
              autoSubmit
              showSendButton={false}
              placeholder={t('puzzle.movePlaceholder')}
              testID="puzzle-move-input"
            />

            <GameMicButton
              showRecognized={showRecognizedFlash}
              isListening={isListening}
              micActive={micActive}
              micMessage={micStatus.message}
              onToggle={() => {
                void triggerHaptic('keyTap');
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
                      {t('puzzle.whitePieces')}
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
                      {t('puzzle.blackPieces')}
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
                      {t('puzzle.repeat')}
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
                      {t('puzzle.nextMoveLabel')}
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
                    {t('puzzle.nextMoveLabel')}
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
                    {t('puzzle.solution')}
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
                  {t('puzzle.solution')}
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
            {t('puzzle.soundOff')}
          </Text>
        )}
      </ScrollView>
    </ModeScreenShell>
  );
}
