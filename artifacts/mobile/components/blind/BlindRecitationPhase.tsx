import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { GameMicButton } from '@/components/game/GameMicButton';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { useSpeechInput } from '@/services/SpeechRecognitionService';

export function BlindRecitationPhase() {
  const colors = useColors();
  const {
    sequence,
    expectedIndex,
    lastFeedback,
    revealedHint,
    recognizedText,
    isSpeaking,
    recordIneligibleNotice,
    attemptSpoken,
    useHelp,
    skipExpectedMove,
    backToSettings,
  } = useBlindSequence();

  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);
  const attemptSpokenRef = useRef(attemptSpoken);
  useEffect(() => {
    attemptSpokenRef.current = attemptSpoken;
  }, [attemptSpoken]);

  useEffect(() => {
    if (!recognizedText) {
      setShowRecognizedFlash(false);
      return;
    }
    setShowRecognizedFlash(true);
    const t = setTimeout(() => setShowRecognizedFlash(false), 900);
    return () => clearTimeout(t);
  }, [recognizedText]);

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    isSpeaking,
    onTranscript: (text) => {
      attemptSpokenRef.current(text);
    },
  });

  return (
    <ModeScreenShell title="Récitation" onBack={backToSettings}>
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
            {lastFeedback ?? 'Dis le prochain coup à voix haute.'}
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

        <GameMicButton
          showRecognized={showRecognizedFlash}
          isListening={isListening}
          micActive={micActive}
          micMessage={micStatus.message}
          onToggle={toggleMic}
          testID="blind-recitation-mic"
        />

        <ChessAnswerInput
          onSubmit={(text) => attemptSpoken(text)}
          enabled
          persistFocus
          placeholder="Ex. e4, Cf3, petit roque…"
        />

        <View style={blindStyles.compactActionRow}>
          <Pressable
            onPress={skipExpectedMove}
            style={({ pressed }) => [
              blindStyles.compactAction,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="blind-recitation-skip"
          >
            <Ionicons name="play-skip-forward-outline" size={16} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              Passer
            </Text>
          </Pressable>
          <Pressable
            onPress={useHelp}
            style={({ pressed }) => [
              blindStyles.compactAction,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="blind-recitation-help"
          >
            <Ionicons name="help-circle-outline" size={16} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              Aide
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ModeScreenShell>
  );
}
