import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { OptionChip } from '@/components/ui/OptionChip';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { GameMicButton } from '@/components/game/GameMicButton';
import { NumberedSanRows } from '@/components/moves/NumberedSanRows';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import {
  ANYCHESS_DIFFICULTIES,
  type AnyChessDifficultyId,
} from '@/lib/difficulty/anyChessDifficulty';
import type { MessageKey } from '@/lib/i18n';
import { defaultKeyValueStorage } from '@/lib/storage';
import {
  OpeningIdentificationRun,
  OpeningQuizRecordsStore,
  OPENING_QUIZ_SESSION_SIZE,
  type OpeningIdentificationRunSnapshot,
} from '@/lib/openingQuiz';

type Phase = 'pick-level' | 'playing' | 'feedback' | 'results' | 'review';

const DIFFICULTY_LABEL: Record<AnyChessDifficultyId, MessageKey> = {
  debutant: 'difficulty.debutant',
  confirme: 'difficulty.confirme',
  expert: 'difficulty.expert',
  grandMaitre: 'difficulty.grandMaitre',
};

const recordsStore = new OpeningQuizRecordsStore(defaultKeyValueStorage);

function phaseFromSnap(snap: OpeningIdentificationRunSnapshot, fallback: Phase): Phase {
  if (snap.insufficientLines) return 'pick-level';
  if (snap.finished) return 'results';
  if (snap.answered) return 'feedback';
  return fallback === 'pick-level' ? 'playing' : fallback;
}

export default function QuelleOuvertureScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const run = useRef(new OpeningIdentificationRun());
  const savedForRun = useRef(false);
  const [phase, setPhase] = useState<Phase>('pick-level');
  const [difficulty, setDifficulty] = useState<AnyChessDifficultyId | null>(null);
  const [snap, setSnap] = useState<OpeningIdentificationRunSnapshot | null>(null);
  const [levelError, setLevelError] = useState<string | null>(null);
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  const applySnap = (next: OpeningIdentificationRunSnapshot, prefer?: Phase) => {
    setSnap(next);
    setPhase(phaseFromSnap(next, prefer ?? phase));
  };

  const startLevel = (level: AnyChessDifficultyId) => {
    setDifficulty(level);
    setLevelError(null);
    savedForRun.current = false;
    const next = run.current.start(level);
    if (next.insufficientLines) {
      setSnap(next);
      setPhase('pick-level');
      setLevelError(
        t('quiz.notEnoughLines', {
          available: next.availableLineCount,
          needed: OPENING_QUIZ_SESSION_SIZE,
        }),
      );
      return;
    }
    applySnap(next, 'playing');
  };

  useEffect(() => {
    if (phase !== 'results' || !snap?.finished || !difficulty || savedForRun.current) return;
    savedForRun.current = true;
    void recordsStore.saveScore(difficulty, snap.score);
  }, [phase, snap, difficulty]);

  const answer = (raw: string) => {
    const next = run.current.answer(raw);
    applySnap(next, 'feedback');
  };

  const goNext = () => {
    const next = run.current.next();
    applySnap(next, next.finished ? 'results' : 'playing');
  };

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    forceOff:
      phase !== 'playing' ||
      !snap ||
      snap.answered ||
      snap.answerMode !== 'free-text',
    isSpeaking: false,
    onTranscript: (raw) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      answer(raw);
    },
  });

  const promptText =
    snap?.promptKind === 'family'
      ? t('quiz.selectFamily')
      : snap?.promptKind === 'variation'
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

      {phase === 'pick-level' ? (
        <View style={styles.block} testID="quelle-level-picker">
          <Text
            style={{
              color: colors.foreground,
              fontFamily: DesignTokens.typography.weightSemiBold,
              fontSize: 16,
            }}
          >
            {t('quiz.pickLevel')}
          </Text>
          <View style={styles.levelRow}>
            {ANYCHESS_DIFFICULTIES.map((id) => (
              <OptionChip
                key={id}
                label={t(DIFFICULTY_LABEL[id])}
                active={difficulty === id}
                onPress={() => startLevel(id)}
                testID={`quelle-level-${id}`}
              />
            ))}
          </View>
          {levelError ? (
            <Text style={{ color: '#c44' }} testID="quelle-insufficient">
              {levelError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {(phase === 'playing' || phase === 'feedback') && snap ? (
        <View style={styles.block}>
          <Text style={{ color: colors.mutedForeground }} testID="quelle-progress">
            {t('vision.questionProgress', {
              current: snap.questionIndex + 1,
              total: snap.totalQuestions,
            })}
          </Text>
          <Text style={{ color: colors.mutedForeground }}>{promptText}</Text>

          {snap.difficulty === 'confirme' && !snap.answered ? (
            <Text
              style={{
                color: colors.primary,
                fontFamily: DesignTokens.typography.weightSemiBold,
              }}
              testID="quelle-step-label"
            >
              {snap.step === 1 ? t('quiz.stepFamily') : t('quiz.stepVariation')}
            </Text>
          ) : null}

          <View
            style={[
              styles.lineCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="quelle-move-rows"
          >
            <NumberedSanRows sans={snap.line?.sans ?? []} />
          </View>

          {phase === 'playing' && !snap.answered ? (
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
          ) : null}

          {phase === 'feedback' && snap.answered ? (
            <View style={{ gap: DesignTokens.spacing.sm }} testID="quelle-feedback">
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
              <AppButton
                label={
                  snap.questionIndex >= snap.totalQuestions - 1
                    ? t('quiz.seeResults')
                    : t('quiz.nextQuestion')
                }
                onPress={goNext}
                testID="quelle-next"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === 'results' && snap ? (
        <View style={styles.block} testID="quelle-results">
          <Text
            style={{
              color: colors.foreground,
              fontFamily: DesignTokens.typography.weightSemiBold,
              fontSize: 22,
            }}
            testID="quelle-final-score"
          >
            {t('quiz.score', {
              correct: snap.score,
              total: snap.totalQuestions || OPENING_QUIZ_SESSION_SIZE,
            })}
          </Text>
          <AppButton
            label={t('quiz.reviewQuestions')}
            onPress={() => setPhase('review')}
            testID="quelle-review-btn"
          />
          <AppButton
            label={t('quiz.replaySameLevel')}
            onPress={() => {
              if (difficulty) startLevel(difficulty);
            }}
            testID="quelle-replay-btn"
          />
          <AppButton
            label={t('quiz.changeLevel')}
            onPress={() => {
              setPhase('pick-level');
              setSnap(null);
              setLevelError(null);
            }}
            testID="quelle-change-level-btn"
          />
          <AppButton
            label={t('quiz.seeRecords')}
            onPress={() => router.push('/records')}
            testID="quelle-records-btn"
          />
        </View>
      ) : null}

      {phase === 'review' && snap ? (
        <View style={styles.block} testID="quelle-review">
          <Text
            style={{
              color: colors.foreground,
              fontFamily: DesignTokens.typography.weightSemiBold,
              fontSize: 16,
            }}
          >
            {t('quiz.reviewQuestions')}
          </Text>
          {snap.review.map((item) => (
            <View
              key={`${item.index}-${item.lineName}`}
              style={[
                styles.reviewRow,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              testID={`quelle-review-${item.index}`}
            >
              <Text style={{ color: colors.mutedForeground }}>
                {item.index + 1}/{snap.totalQuestions}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: 'Inter_500Medium',
                  flex: 1,
                }}
              >
                {item.lineName}
              </Text>
              <Text style={{ color: item.correct ? '#398a55' : '#c44' }}>
                {item.correct ? t('common.correct') : t('common.incorrect')}
              </Text>
            </View>
          ))}
          <AppButton
            label={t('quiz.seeResults')}
            onPress={() => setPhase('results')}
            testID="quelle-back-results"
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.md,
  },
  block: {
    gap: DesignTokens.spacing.md,
    width: '100%',
  },
  levelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  reviewRow: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    padding: DesignTokens.spacing.md,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
