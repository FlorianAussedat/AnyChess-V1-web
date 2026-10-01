/**
 * Culture générale — mixed chess culture quiz (offline).
 * Question data lives in lib/chessCulture; this screen only manages UI/session state.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessCultureVisual } from '@/components/chessCulture/ChessCultureVisual';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { usePreferences } from '@/hooks/usePreferences';
import { DesignTokens } from '@/constants/designTokens';
import { sideToMoveLabel } from '@/lib/playMove';
import {
  CHESS_CULTURE_QUESTIONS,
  DEFAULT_CHESS_CULTURE_SESSION_SIZE,
  boardFromFen,
  buildChessCultureReview,
  calculateChessCultureScore,
  createChessCultureQuizSession,
  getEligibleChessCultureQuestions,
  localizeChessCultureQuestions,
  questionFeedbackStore,
  quizHistoryStore,
  type ChessCultureSessionQuestion,
} from '@/lib/chessCulture';
import { getActivitySession } from '@/lib/activitySessions';
import { usePersistedActivity } from '@/hooks/usePersistedActivity';
import { useActiveSessionBack } from '@/hooks/useActiveSessionBack';

type Phase = 'loading' | 'playing' | 'finished';

export default function CultureGeneraleQuizScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { language } = usePreferences();
  const insets = useAppSafeInsets();
  const boardSize = useBoardSize('wide');
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const resumeSessionId =
    typeof params.sessionId === 'string' ? params.sessionId : undefined;

  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<ChessCultureSessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState<
    number | null
  >(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [openExplain, setOpenExplain] = useState<Record<number, boolean>>({});

  const startSession = useCallback(async () => {
    setPhase('loading');
    const [snapshot, seenKeys] = await Promise.all([
      questionFeedbackStore.getSnapshot(),
      quizHistoryStore.getSeenKeys(),
    ]);
    const localized = localizeChessCultureQuestions(
      CHESS_CULTURE_QUESTIONS,
      language,
    );
    const eligible = getEligibleChessCultureQuestions(localized, snapshot);
    const next = createChessCultureQuizSession(
      eligible,
      DEFAULT_CHESS_CULTURE_SESSION_SIZE,
      Math.random,
      seenKeys,
    );
    setSession(next);
    setIndex(0);
    setAnswers(next.map(() => null));
    setSelectedDisplayIndex(null);
    setHasAnswered(false);
    setOpenExplain({});
    setPhase(next.length === 0 ? 'finished' : 'playing');
  }, [language]);

  type CulturePayload = {
    phase: Phase;
    session: ChessCultureSessionQuestion[];
    index: number;
    score: number;
    selectedDisplayIndex: number | null;
    hasAnswered: boolean;
    answers?: (number | null)[];
  };

  const review = useMemo(
    () => buildChessCultureReview(session, answers),
    [session, answers],
  );
  const derivedScore = review.filter((item) => item.correct).length;
  const scoreSummary = calculateChessCultureScore(derivedScore, session.length);

  const { sessionId } = usePersistedActivity<CulturePayload>({
    kind: 'culture',
    modeId: 'quiz-ouverture',
    resumeSessionId,
    title: t('quiz.culture'),
    summary: session.length ? `${derivedScore}/${session.length}` : '',
    routeFor: (id) => `/quiz-ouverture/culture?sessionId=${encodeURIComponent(id)}`,
    enabled: phase === 'playing' && session.length > 0,
    revision: `${phase}|${index}|${derivedScore}|${hasAnswered}|${session.length}`,
    capture: () => ({
      phase,
      session,
      index,
      score: derivedScore,
      selectedDisplayIndex,
      hasAnswered,
      answers,
    }),
    apply: (payload) => {
      const nextAnswers =
        payload.answers ?? payload.session.map(() => null as number | null);
      if (
        payload.hasAnswered &&
        payload.selectedDisplayIndex != null &&
        nextAnswers[payload.index] == null
      ) {
        nextAnswers[payload.index] = payload.selectedDisplayIndex;
      }
      setSession(payload.session);
      setIndex(payload.index);
      setAnswers(nextAnswers);
      setSelectedDisplayIndex(payload.selectedDisplayIndex);
      setHasAnswered(payload.hasAnswered);
      setPhase(payload.phase);
    },
  });

  const onBack = useActiveSessionBack({
    sessionActive: phase === 'playing',
    kind: 'exercice',
    activityId: sessionId,
    onLeave: () => router.replace('/quiz-ouverture' as Href),
    onNavigateBack: () => router.navigate('/'),
    captureHardwareBack: true,
  });

  useEffect(() => {
    if (resumeSessionId && getActivitySession(resumeSessionId)) return;
    void startSession();
  }, [resumeSessionId, startSession]);

  const current = session[index];
  useEffect(() => {
    if (phase === 'playing' && current) {
      void quizHistoryStore.markSeen(current.question).catch(() => {
        // A storage failure must not prevent answering the quiz.
      });
    }
  }, [phase, current]);
  const total = session.length;
  const isLast = index >= total - 1;

  const onSelectAnswer = (displayIndex: number) => {
    if (hasAnswered || !current) return;
    setSelectedDisplayIndex(displayIndex);
    setHasAnswered(true);
    setAnswers((prev) => {
      const next = prev.length === session.length ? [...prev] : session.map(() => null);
      next[index] = displayIndex;
      return next;
    });
  };

  const goNext = () => {
    if (!hasAnswered) return;
    if (isLast) {
      setPhase('finished');
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setSelectedDisplayIndex(null);
    setHasAnswered(false);
  };

  const boardFen = current?.question.presentation?.boardFen;
  const boardTurn = boardFen?.split(' ')[1];
  const boardSideToMove = boardTurn === 'w' || boardTurn === 'b' ? boardTurn : null;
  let board = null;
  if (boardFen) {
    try {
      board = boardFromFen(boardFen);
    } catch {
      board = null;
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <ScreenHeader
        onBack={onBack}
        title={t('quiz.quiz')}
        subtitle={t('quiz.cultureMixed')}
        backTestID="culture-quiz-back"
      />

      {phase === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {phase === 'playing' && current ? (
        <View style={styles.block}>
          <Text style={[styles.progress, { color: colors.mutedForeground }]}>
            {t('vision.questionProgress', { current: index + 1, total })}
          </Text>
          <View
            style={[styles.progressTrack, { backgroundColor: colors.border }]}
            testID="culture-progress-bar"
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.round(((index + 1) / Math.max(total, 1)) * 100)}%`,
                },
              ]}
            />
          </View>

          <View
            style={[
              styles.questionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="culture-question-card"
            accessibilityRole="text"
          >
            <View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
            <Text style={[styles.question, { color: colors.foreground }]}>
              {current.question.question}
            </Text>
          </View>

          <ChessCultureVisual presentation={current.question.presentation} />

          {board ? (
            <View
              style={[
                styles.boardWrap,
                { width: boardSize, alignSelf: 'center' },
              ]}
            >
              <ChessBoard
                board={board}
                lastMove={null}
                isFlipped={current.question.presentation?.boardFlipped === true}
                showCoordinates={
                  current.question.presentation?.showCoordinates !== false
                }
                onSquarePress={undefined}
                sizeMode="wide"
                size={boardSize}
              />
              {boardSideToMove ? (
                <Text
                  style={[styles.sideToMove, { color: colors.primary }]}
                  testID="culture-side-to-move"
                >
                  {sideToMoveLabel(boardSideToMove)}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.answers}>
            {current.displayAnswers.map((answer, i) => {
              const selected = selectedDisplayIndex === i;
              const isCorrect = i === current.correctDisplayIndex;
              let borderColor: string = colors.border;
              let backgroundColor: string = colors.card;
              const textColor = colors.foreground;
              if (hasAnswered) {
                if (isCorrect) {
                  borderColor = '#398a55';
                  backgroundColor = 'rgba(57, 138, 85, 0.18)';
                } else if (selected) {
                  borderColor = '#c44';
                  backgroundColor = 'rgba(204, 68, 68, 0.16)';
                }
              } else if (selected) {
                borderColor = colors.primary;
              }
              return (
                <Pressable
                  key={`${current.question.id}-${i}`}
                  testID={`culture-answer-${i}`}
                  disabled={hasAnswered}
                  onPress={() => onSelectAnswer(i)}
                  style={({ pressed }) => [
                    styles.answer,
                    {
                      borderColor,
                      backgroundColor,
                      opacity: pressed && !hasAnswered ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.answerText, { color: textColor }]}>
                    {answer}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {hasAnswered ? (
            <View style={styles.feedbackBlock}>
              <Text
                style={{
                  color:
                    selectedDisplayIndex === current.correctDisplayIndex
                      ? '#398a55'
                      : '#c44',
                  fontFamily: DesignTokens.typography.weightSemiBold,
                  fontSize: 16,
                }}
              >
                {selectedDisplayIndex === current.correctDisplayIndex
                  ? t('quiz.goodAnswer')
                  : t('quiz.badAnswer')}
              </Text>
              {selectedDisplayIndex !== current.correctDisplayIndex ? (
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  {t('quiz.correctWas', {
                    answer: current.displayAnswers[current.correctDisplayIndex],
                  })}
                </Text>
              ) : null}
              {current.question.explanation.trim() ? (
                <Text
                  style={[styles.explanation, { color: colors.mutedForeground }]}
                >
                  {current.question.explanation}
                </Text>
              ) : null}

              <Pressable
                testID="culture-next"
                onPress={goNext}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {isLast ? t('quiz.seeResults') : t('quiz.nextQuestion')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === 'finished' ? (
        <View style={styles.results} testID="culture-results">
          <View
            style={[
              styles.resultsCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="culture-results-card"
          >
            <View style={[styles.resultsAccent, { backgroundColor: colors.primary }]} />
            <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
              {t('quiz.finished')}
            </Text>
            {total === 0 ? (
              <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                {t('quiz.noQuestions')}
              </Text>
            ) : (
              <>
                <Text
                  style={[styles.scoreLine, { color: colors.foreground }]}
                  testID="culture-final-score"
                >
                  {t('quiz.score', {
                    correct: scoreSummary.correct,
                    total: scoreSummary.total,
                  })}
                </Text>
                <Text style={[styles.percent, { color: colors.mutedForeground }]}>
                  {scoreSummary.percentage} %
                </Text>
                <Text style={[styles.resultsCount, { color: colors.foreground }]}>
                  {t('quiz.correctAnswersCount', { count: scoreSummary.correct })}
                </Text>
                <Text style={[styles.resultsCount, { color: colors.foreground }]}>
                  {t('quiz.incorrectAnswersCount', {
                    count: scoreSummary.total - scoreSummary.correct,
                  })}
                </Text>
              </>
            )}
          </View>

          {review.length > 0 ? (
            <View style={styles.reviewBlock} testID="culture-review">
              <Text style={[styles.reviewHeading, { color: colors.foreground }]}>
                {t('quiz.yourAnswers')}
              </Text>
              {review.map((item) => {
                const expanded = openExplain[item.index] === true;
                const statusColor = item.correct ? '#398a55' : '#c44';
                return (
                  <View
                    key={`${item.index}-${item.question}`}
                    style={[
                      styles.reviewCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    testID={`culture-review-${item.index}`}
                  >
                    <Text style={[styles.reviewIndex, { color: colors.mutedForeground }]}>
                      {item.index + 1}/{scoreSummary.total}
                    </Text>
                    <Text style={[styles.reviewQuestion, { color: colors.foreground }]}>
                      {item.question}
                    </Text>
                    <View style={styles.reviewStatusRow}>
                      <Ionicons
                        name={item.correct ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={statusColor}
                      />
                      <Text
                        style={[styles.reviewStatus, { color: statusColor }]}
                        testID={`culture-review-status-${item.index}`}
                      >
                        {item.correct ? t('quiz.goodAnswer') : t('quiz.badAnswer')}
                      </Text>
                    </View>
                    <Text style={[styles.reviewMeta, { color: colors.foreground }]}>
                      {t('quiz.yourChoice', { answer: item.selectedAnswer })}
                    </Text>
                    {!item.correct ? (
                      <Text style={[styles.reviewMeta, { color: colors.foreground }]}>
                        {t('quiz.correctWas', { answer: item.correctAnswer })}
                      </Text>
                    ) : null}
                    {item.explanation ? (
                      <>
                        <Pressable
                          testID={`culture-review-explain-${item.index}`}
                          onPress={() =>
                            setOpenExplain((prev) => ({
                              ...prev,
                              [item.index]: !expanded,
                            }))
                          }
                          accessibilityRole="button"
                          accessibilityLabel={
                            expanded ? t('quiz.hideExplanation') : t('quiz.seeExplanation')
                          }
                          style={({ pressed }) => [
                            styles.explainBtn,
                            { opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                            {expanded ? t('quiz.hideExplanation') : t('quiz.seeExplanation')}
                          </Text>
                        </Pressable>
                        {expanded ? (
                          <Text
                            style={[styles.explanation, { color: '#B7CDE0' }]}
                            testID={`culture-review-explanation-${item.index}`}
                          >
                            {item.explanation}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <Pressable
            testID="culture-replay"
            onPress={() => void startSession()}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: colors.primaryForeground,
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {t('quiz.replay')}
            </Text>
          </Pressable>
          <Pressable
            testID="culture-back-hub"
            onPress={() => router.replace('/quiz-ouverture')}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: colors.foreground,
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {t('quiz.backToHub')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 18,
    gap: 14,
    flexGrow: 1,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  block: {
    gap: 14,
    marginTop: 4,
  },
  progress: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.card,
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4,
  },
  question: {
    flex: 1,
    fontSize: 20,
    fontFamily: DesignTokens.typography.weightBold,
    lineHeight: 28,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  boardWrap: {
    alignItems: 'center',
    marginVertical: 4,
  },
  sideToMove: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  answers: {
    gap: 8,
  },
  answer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
  },
  answerText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  feedbackBlock: {
    gap: 10,
    marginTop: 4,
  },
  explanation: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightRegular,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  results: {
    gap: 14,
    marginTop: 8,
  },
  resultsCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.card,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  resultsAccent: {
    height: 4,
    alignSelf: 'stretch',
  },
  resultsTitle: {
    marginTop: 18,
    fontSize: 22,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
  },
  scoreLine: {
    marginTop: 12,
    fontSize: 28,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
  },
  percent: {
    marginTop: 4,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  resultsCount: {
    marginTop: 8,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  reviewBlock: {
    gap: 10,
  },
  reviewHeading: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'left',
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: 14,
    gap: 8,
  },
  reviewIndex: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  reviewQuestion: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
    lineHeight: 22,
  },
  reviewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewStatus: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  reviewMeta: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  explainBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    minHeight: 32,
    justifyContent: 'center',
  },
});
