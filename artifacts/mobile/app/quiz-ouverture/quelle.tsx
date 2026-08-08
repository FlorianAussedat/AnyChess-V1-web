import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { GameMicButton } from '@/components/game/GameMicButton';
import { NumberedSanRows } from '@/components/moves/NumberedSanRows';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import {
  OpeningIdentificationSession,
  type OpeningIdentificationSnapshot,
} from '@/lib/openingQuiz';

export default function QuelleOuvertureScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const session = useRef(new OpeningIdentificationSession());
  const [snap, setSnap] = useState<OpeningIdentificationSnapshot>(() => session.current.start());
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  const answer = (raw: string) => {
    setSnap(session.current.answer(raw));
  };

  const next = () =>
    setSnap(session.current.start(snap.line ? [snap.line.identity.name] : []));

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    forceOff: snap.answered,
    isSpeaking: false,
    onTranscript: (raw) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      answer(raw);
    },
  });

  return (
    <ScrollView
      contentContainerStyle={[
        styles.page,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + DesignTokens.spacing.md,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      testID="quelle-screen"
    >
      <ScreenHeader onBack={() => router.back()} title="Quelle ouverture ?" showSound />
      <Text style={{ color: colors.mutedForeground }}>
        Identifie l’ouverture après cette ligne :
      </Text>
      <View
        style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="quelle-move-rows"
      >
        <NumberedSanRows sans={snap.line?.sans ?? []} />
      </View>
      {!snap.answered ? (
        <View style={{ gap: DesignTokens.spacing.md }}>
          <ChessAnswerInput
            onSubmit={answer}
            enabled
            persistFocus={false}
            placeholder="Nom de l’ouverture"
            testID="quelle-answer-input"
          />
          <GameMicButton
            showRecognized={showRecognizedFlash}
            isListening={isListening}
            micActive={micActive}
            micMessage={micStatus.message}
            onToggle={toggleMic}
            testID="quelle-mic"
          />
        </View>
      ) : (
        <View style={{ gap: DesignTokens.spacing.sm }}>
          <Text style={{ color: snap.verdict?.correct ? '#398a55' : '#c44' }}>
            {snap.verdict?.correct
              ? `Correct${snap.verdict.acceptedAs === 'family' ? ' (famille acceptée)' : ''} !`
              : 'Incorrect.'}
          </Text>
          <Text style={{ color: colors.foreground }}>Réponse : {snap.line?.identity.name}</Text>
          <AppButton label="Nouvelle ouverture" onPress={next} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.md,
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingHorizontal: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.md,
    alignSelf: 'stretch',
  },
});
