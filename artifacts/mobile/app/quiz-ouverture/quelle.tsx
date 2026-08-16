import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { GameMicButton } from '@/components/game/GameMicButton';
import { NumberedSanRows } from '@/components/moves/NumberedSanRows';
import { DifficultySelector } from '@/components/difficulty/DifficultySelector';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import type { AnyChessDifficultyId } from '@/lib/difficulty/anyChessDifficulty';
import {
  OpeningIdentificationSession,
  type OpeningIdentificationSnapshot,
} from '@/lib/openingQuiz';

export default function QuelleOuvertureScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const session = useRef(new OpeningIdentificationSession());
  const [difficulty, setDifficulty] = useState<AnyChessDifficultyId>('debutant');
  const [snap, setSnap] = useState<OpeningIdentificationSnapshot>(() =>
    session.current.startWithDifficulty('debutant'),
  );
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  const answer = (raw: string) => {
    setSnap(session.current.answer(raw));
  };

  const next = () =>
    setSnap(
      session.current.start(snap.line ? [snap.line.identity.name] : []),
    );

  const onDifficultyChange = (nextDifficulty: AnyChessDifficultyId) => {
    setDifficulty(nextDifficulty);
    setSnap(
      session.current.startWithDifficulty(
        nextDifficulty,
        snap.line ? [snap.line.identity.name] : [],
      ),
    );
  };

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    forceOff: snap.answered || snap.answerMode !== 'free-text',
    isSpeaking: false,
    onTranscript: (raw) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      answer(raw);
    },
  });

  const promptText =
    snap.promptKind === 'family'
      ? t('quiz.selectFamily')
      : snap.promptKind === 'variation'
        ? t('quiz.selectVariation')
        : t('quiz.identifyPrompt');

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
      <ScreenHeader onBack={() => router.back()} title={t('quiz.quelle')} showSound />

      <DifficultySelector
        value={difficulty}
        onChange={onDifficultyChange}
        testID="quelle-difficulty"
      />

      <Text style={{ color: colors.mutedForeground }}>{promptText}</Text>

      {snap.difficulty === 'confirme' && !snap.answered && (
        <Text
          style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}
          testID="quelle-step-label"
        >
          {snap.step === 1 ? t('quiz.stepFamily') : t('quiz.stepVariation')}
        </Text>
      )}

      <View
        style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="quelle-move-rows"
      >
        <NumberedSanRows sans={snap.line?.sans ?? []} />
      </View>

      {!snap.answered ? (
        snap.answerMode === 'mcq' ? (
          <View style={styles.options} testID="quelle-mcq">
            {snap.options.map((option) => (
              <Pressable
                key={option}
                testID={`quelle-option-${option}`}
                onPress={() => answer(option)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: DesignTokens.spacing.md }} testID="quelle-freetext">
            <ChessAnswerInput
              inputType="free-text"
              onSubmit={answer}
              enabled
              persistFocus={false}
              placeholder={t('quiz.openingPlaceholder')}
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
        )
      ) : (
        <View style={{ gap: DesignTokens.spacing.sm }}>
          <Text style={{ color: snap.verdict?.correct ? '#398a55' : '#c44' }}>
            {snap.verdict?.correct
              ? snap.verdict.acceptedAs === 'family'
                ? t('quiz.correctFamily')
                : t('quiz.correctExclaim')
              : t('quiz.incorrect')}
          </Text>
          <Text style={{ color: colors.foreground }}>
            {t('quiz.answerIs', { name: snap.line?.identity.name ?? '' })}
          </Text>
          <AppButton label={t('quiz.newOpening')} onPress={next} />
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
  options: {
    gap: DesignTokens.spacing.sm,
    width: '100%',
  },
  option: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.md,
  },
});
