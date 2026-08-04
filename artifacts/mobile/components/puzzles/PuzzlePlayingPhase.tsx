import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';

export function PuzzlePlayingPhase() {
  const colors = useColors();
  const { soundEnabled } = useAudioSettings();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const {
    phase,
    submode,
    puzzle,
    stats,
    displayBoard,
    lastMove,
    orientation,
    boardVisible,
    pieceRevealFilter,
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

  const submitSpoken = useCallback(
    (text: string) => {
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

  return (
    <ModeScreenShell title={title} onBack={backToHub}>
      <ScrollView contentContainerStyle={puzzleStyles.body}>
        {!!puzzle && (
          <Text style={[puzzleStyles.meta, { color: colors.mutedForeground }]}>
            {puzzle.id} · cote {puzzle.rating} (Lichess) ·{' '}
            {sideToMove === 'w' ? 'Trait aux Blancs' : 'Trait aux Noirs'}
            {' · '}
            Série : {currentStreak}
          </Text>
        )}

        <View style={[puzzleStyles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {lastFeedback ?? (isReplaying ? 'Relecture…' : 'À toi de trouver le coup.')}
          </Text>
          {!!nextMoveHint && !solutionLine && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 6 }}>
              {nextMoveHint}
            </Text>
          )}
          {!!solutionLine && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 6 }}>
              {solutionLine}
            </Text>
          )}
        </View>

        {boardVisible || pieceRevealFilter !== 'hidden' ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            {boardVisible && (
              <View style={{ alignSelf: 'flex-end' }}>
                <BoardCoordinatesToggle
                  visible={showCoordinates}
                  onToggle={() => {
                    void toggleCoordinates();
                  }}
                />
              </View>
            )}
            <ChessBoard
              board={displayBoard}
              lastMove={lastMove}
              isFlipped={orientation === 'b'}
              selectedSquare={selected}
              legalDots={legalDests}
              onSquarePress={onSquarePress}
              showCoordinates={boardVisible && showCoordinates}
            />
          </View>
        ) : (
          <HiddenBoardPlaceholder />
        )}

        {submode === 'blind' && !!positionNarration && pieceRevealFilter === 'hidden' && (
          <View style={[puzzleStyles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>
              {positionNarration}
            </Text>
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
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                toggleMic();
              }}
              style={({ pressed }) => [
                puzzleStyles.cta,
                {
                  backgroundColor: isListening ? '#C0392B' : micActive ? '#D4880A' : colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={20} color="#fff" />
              <Text style={[puzzleStyles.ctaLabel, { color: '#fff' }]}>
                {isListening ? "J'écoute…" : micActive ? 'Micro actif' : 'Activer le micro'}
              </Text>
            </Pressable>
            {!!micStatus.message && (
              <Text style={{ color: '#F5A623', fontSize: 12, textAlign: 'center' }}>{micStatus.message}</Text>
            )}

            {submode === 'blind' && (
              <>
                <Pressable
                  onPress={revealWhitePieces}
                  disabled={!!stats?.helps.whiteReveal}
                  style={({ pressed }) => [
                    puzzleStyles.secondaryCta,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity: stats?.helps.whiteReveal ? 0.45 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                    Afficher les pièces blanches
                  </Text>
                </Pressable>
                <Pressable
                  onPress={revealBlackPieces}
                  disabled={!!stats?.helps.blackReveal}
                  style={({ pressed }) => [
                    puzzleStyles.secondaryCta,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity: stats?.helps.blackReveal ? 0.45 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                    Afficher les pièces noires
                  </Text>
                </Pressable>
                <Pressable
                  onPress={repeatPosition}
                  style={({ pressed }) => [
                    puzzleStyles.secondaryCta,
                    { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="volume-medium-outline" size={18} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                    Répéter la position
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={revealNextMove}
              style={({ pressed }) => [
                puzzleStyles.secondaryCta,
                { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="arrow-forward-outline" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                Coup suivant
              </Text>
            </Pressable>

            <Pressable
              onPress={revealSolution}
              style={({ pressed }) => [
                puzzleStyles.secondaryCta,
                { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="bulb-outline" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                Solution
              </Text>
            </Pressable>
          </>
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
