/**
 * Culture générale — mixed chess culture quiz (offline).
 * Question data lives in lib/chessCulture; this screen only manages UI/session state.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessCultureVisual } from '@/components/chessCulture/ChessCultureVisual';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  CHESS_CULTURE_QUESTIONS,
  DEFAULT_CHESS_CULTURE_SESSION_SIZE,
  boardFromFen,
  calculateChessCultureScore,
  createChessCultureQuizSession,
  getEligibleChessCultureQuestions,
  questionFeedbackStore,
  type ChessCultureFeedbackSnapshot,
  type ChessCultureFeedbackVote,
  type ChessCultureSessionQuestion,
} from '@/lib/chessCulture';

type Phase = 'loading' | 'playing' | 'finished';

export default function CultureGeneraleQuizScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useAppSafeInsets();
  const boardSize = useBoardSize('wide');
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<ChessCultureSessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [feedbackSnapshot, setFeedbackSnapshot] =
    useState<ChessCultureFeedbackSnapshot | null>(null);
  const [presentationVote, setPresentationVote] =
    useState<ChessCultureFeedbackVote | null>(null);

  /** Snapshot before any vote on the current question presentation. */
  const snapshotBeforePresentation = useRef<ChessCultureFeedbackSnapshot | null>(null);

  const startSession = useCallback(async () => {
    setPhase('loading');
    const snapshot = await questionFeedbackStore.getSnapshot();
    const eligible = getEligibleChessCultureQuestions(CHESS_CULTURE_QUESTIONS, snapshot);
    const next = createChessCultureQuizSession(
      eligible,
      DEFAULT_CHESS_CULTURE_SESSION_SIZE,
    );
    setFeedbackSnapshot(snapshot);
    snapshotBeforePresentation.current = snapshot;
    setSession(next);
    setIndex(0);
    setScore(0);
    setSelectedDisplayIndex(null);
    setHasAnswered(false);
    setPresentationVote(null);
    setPhase(next.length === 0 ? 'finished' : 'playing');
  }, []);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  const current = session[index];
  const total = session.length;
  const isLast = index >= total - 1;
  const scoreSummary = calculateChessCultureScore(score, total);

  const onSelectAnswer = (displayIndex: number) => {
    if (hasAnswered || !current) return;
    setSelectedDisplayIndex(displayIndex);
    setHasAnswered(true);
    if (displayIndex === current.correctDisplayIndex) {
      setScore((s) => s + 1);
    }
  };

  const onFeedbackVote = async (vote: ChessCultureFeedbackVote) => {
    if (!current || !hasAnswered || !snapshotBeforePresentation.current) return;
    setPresentationVote(vote);
    const next = await questionFeedbackStore.submitPresentationVote(
      current.question,
      vote,
      snapshotBeforePresentation.current,
    );
    setFeedbackSnapshot(next);
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
    setPresentationVote(null);
    // New presentation: base feedback is whatever was persisted after the previous vote.
    snapshotBeforePresentation.current = feedbackSnapshot;
  };

  const boardFen = current?.question.presentation?.boardFen;
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
        onBack={() => router.back()}
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

          <Text style={[styles.question, { color: colors.foreground }]}>
            {current.question.question}
          </Text>

          <ChessCultureVisual presentation={current.question.presentation} />

          {board ? (
            <View style={[styles.boardWrap, { width: boardSize, alignSelf: 'center' }]}>
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
                  <Text style={[styles.answerText, { color: textColor }]}>{answer}</Text>
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
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                  {t('quiz.correctWas', {
                    answer: current.displayAnswers[current.correctDisplayIndex],
                  })}
                </Text>
              ) : null}
              <Text style={[styles.explanation, { color: colors.mutedForeground }]}>
                {current.question.explanation}
              </Text>

              <View style={styles.qualityBlock}>
                <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>
                  {t('quiz.wasQuestionCorrect')}
                </Text>
                <View style={styles.qualityRow}>
                  <Pressable
                    testID="culture-feedback-up"
                    accessibilityLabel={t('a11y.questionCorrect')}
                    onPress={() => void onFeedbackVote('up')}
                    style={({ pressed }) => [
                      styles.qualityBtn,
                      {
                        borderColor:
                          presentationVote === 'up' ? colors.primary : colors.border,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={presentationVote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={18}
                      color={presentationVote === 'up' ? colors.primary : colors.foreground}
                    />
                  </Pressable>
                  <Pressable
                    testID="culture-feedback-down"
                    accessibilityLabel={t('a11y.questionIncorrect')}
                    onPress={() => void onFeedbackVote('down')}
                    style={({ pressed }) => [
                      styles.qualityBtn,
                      {
                        borderColor:
                          presentationVote === 'down' ? '#c44' : colors.border,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        presentationVote === 'down' ? 'thumbs-down' : 'thumbs-down-outline'
                      }
                      size={18}
                      color={presentationVote === 'down' ? '#c44' : colors.foreground}
                    />
                  </Pressable>
                </View>
              </View>

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
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                  {isLast ? t('quiz.seeResults') : t('quiz.nextQuestion')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === 'finished' ? (
        <View style={styles.results}>
          <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
            {t('quiz.finished')}
          </Text>
          {total === 0 ? (
            <Text style={{ color: colors.mutedForeground }}>
              {t('quiz.noQuestions')}
            </Text>
          ) : (
            <>
              <Text style={[styles.scoreLine, { color: colors.foreground }]}>
                {t('quiz.score', {
                  correct: scoreSummary.correct,
                  total: scoreSummary.total,
                })}
              </Text>
              <Text style={[styles.percent, { color: colors.mutedForeground }]}>
                {scoreSummary.percentage} %
              </Text>
            </>
          )}
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
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
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
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
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
  title: {
    fontSize: 28,
    fontFamily: DesignTokens.typography.weightBold,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightRegular,
    lineHeight: 20,
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
  question: {
    fontSize: 18,
    fontFamily: DesignTokens.typography.weightSemiBold,
    lineHeight: 26,
  },
  boardWrap: {
    alignItems: 'center',
    marginVertical: 4,
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
  qualityBlock: {
    gap: 8,
    marginTop: 4,
  },
  qualityLabel: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  qualityBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 12,
    marginTop: 12,
  },
  resultsTitle: {
    fontSize: 24,
    fontFamily: DesignTokens.typography.weightBold,
  },
  scoreLine: {
    fontSize: 22,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  percent: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
});
