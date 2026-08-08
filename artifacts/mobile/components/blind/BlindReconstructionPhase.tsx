import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { GameMicButton } from '@/components/game/GameMicButton';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { sfxService } from '@/services/SfxService';

export function BlindReconstructionPhase() {
  const colors = useColors();
  const boardSize = useBoardSize('wide');
  const {
    board,
    lastMove,
    orientation,
    sequence,
    expectedIndex,
    lastFeedback,
    revealedHint,
    recognizedText,
    isSpeaking,
    recordIneligibleNotice,
    getLegalDestinations,
    attemptMove,
    attemptSpoken,
    useHelp,
    backToSettings,
  } = useBlindSequence();

  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  useEffect(() => {
    setSelected(null);
    setLegalDests([]);
  }, [expectedIndex]);

  useEffect(() => {
    if (!recognizedText) {
      setShowRecognizedFlash(false);
      return;
    }
    setShowRecognizedFlash(true);
    const t = setTimeout(() => setShowRecognizedFlash(false), 900);
    return () => clearTimeout(t);
  }, [recognizedText]);

  const attemptSpokenRef = useRef(attemptSpoken);
  useEffect(() => {
    attemptSpokenRef.current = attemptSpoken;
  }, [attemptSpoken]);

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    isSpeaking,
    onTranscript: (text) => {
      const result = attemptSpokenRef.current(text);
      if (result === 'wrong' || result === 'illegal') void sfxService.playError();
      else if (result === 'correct') void sfxService.playSuccess();
    },
  });

  const onSquarePress = useCallback(
    (square: string) => {
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
        const ok = attemptMove(selected, square);
        if (!ok) void sfxService.playError();
        else void sfxService.playSuccess();
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
    [selected, legalDests, getLegalDestinations, attemptMove],
  );

  return (
    <ModeScreenShell title="Reconstruction" onBack={backToSettings}>
      <ScrollView
        contentContainerStyle={blindStyles.phaseBody}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            blindStyles.statusCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            Coup {Math.min(expectedIndex + 1, sequence.length)} / {sequence.length}
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {lastFeedback ?? 'Reproduis le prochain coup.'}
          </Text>
          {!!recognizedText && (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
              Reconnu : {recognizedText}
            </Text>
          )}
          {!!revealedHint && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
              {revealedHint}
            </Text>
          )}
        </View>

        {!!recordIneligibleNotice && (
          <View
            style={[
              blindStyles.ineligibleBanner,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
            testID="blind-record-ineligible"
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
              {recordIneligibleNotice}
            </Text>
          </View>
        )}

        <View style={{ alignItems: 'center', alignSelf: 'center', width: boardSize }}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            selectedSquare={selected}
            legalDots={legalDests}
            onSquarePress={onSquarePress}
            sizeMode="wide"
            size={boardSize}
          />
        </View>

        <GameMicButton
          showRecognized={showRecognizedFlash}
          isListening={isListening}
          micActive={micActive}
          micMessage={micStatus.message}
          onToggle={toggleMic}
          testID="blind-reconstruction-mic"
        />

        <ChessAnswerInput
          onSubmit={(text) => {
            const result = attemptSpoken(text);
            if (result === 'wrong' || result === 'illegal') void sfxService.playError();
            else if (result === 'correct') void sfxService.playSuccess();
          }}
          enabled
          persistFocus
          placeholder="Ex. e4, Cf3, petit roque…"
        />

        <Pressable
          onPress={useHelp}
          style={({ pressed }) => [
            blindStyles.compactAction,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.7 : 1,
              alignSelf: 'stretch',
            },
          ]}
          testID="blind-reconstruction-help"
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            Aide
          </Text>
        </Pressable>
      </ScrollView>
    </ModeScreenShell>
  );
}
