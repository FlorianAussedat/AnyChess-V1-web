import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
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
    attemptSpoken,
    useHelp,
    skipExpectedMove,
    backToSettings,
  } = useBlindSequence();

  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    onTranscript: (text) => {
      attemptSpoken(text);
    },
  });

  return (
    <ModeScreenShell title="Récitation" onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <View style={[blindStyles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

        <View style={[blindStyles.hiddenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="mic-outline" size={40} color={colors.mutedForeground} />
          <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Ex. « e4 », « Cavalier f3 », « petit roque »
          </Text>
        </View>

        <ChessAnswerInput
          onSubmit={(text) => attemptSpoken(text)}
          enabled
          persistFocus
          placeholder="Ex. e4, Cf3, petit roque…"
        />

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleMic();
          }}
          style={({ pressed }) => [
            blindStyles.cta,
            {
              backgroundColor: isListening ? '#C0392B' : micActive ? '#D4880A' : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={20} color="#fff" />
          <Text style={[blindStyles.ctaLabel, { color: '#fff' }]}>
            {isListening ? "J'écoute…" : micActive ? 'Micro actif' : 'Activer le micro'}
          </Text>
        </Pressable>
        {!!micStatus.message && (
          <Text style={{ color: '#F5A623', fontSize: 12, textAlign: 'center' }}>{micStatus.message}</Text>
        )}

        <Pressable
          onPress={skipExpectedMove}
          style={({ pressed }) => [
            blindStyles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="play-skip-forward-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Passer ce coup
          </Text>
        </Pressable>

        <Pressable
          onPress={useHelp}
          style={({ pressed }) => [
            blindStyles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Aide — révéler le coup
          </Text>
        </Pressable>
      </View>
    </ModeScreenShell>
  );
}
