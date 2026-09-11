/**
 * Play / result screen for Entraînement aux Finales — shared Classic UI + overlays.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Chess } from 'chess.js';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { ChessMoveKeypad } from '@/components/game/ChessMoveKeypad';
import { ChessKeyboardToggle } from '@/components/game/ChessKeyboardToggle';
import { GameMicButton } from '@/components/game/GameMicButton';
import { BoardToolbar } from '@/components/BoardToolbar';
import { AppButton } from '@/components/ui/AppButton';
import { PositionReferenceBadge } from '@/components/exercise/PositionReferenceBadge';
import { TryAgainPromptModal } from '@/components/exercise/TryAgainPromptModal';
import {
  ExerciseResultOverlayHost,
  type ResultOverlayKind,
} from '@/components/review/ExerciseResultOverlayHost';
import { useColors } from '@/hooks/useColors';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useTranslation } from '@/hooks/useTranslation';
import { useChessInputMode } from '@/hooks/useChessInputMode';
import { usePreferences } from '@/hooks/usePreferences';
import {
  useExerciseBoardTouch,
  useExerciseSpeechInput,
} from '@/hooks/useExerciseChessInput';
import { DesignTokens } from '@/constants/designTokens';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import {
  EndgameEngineStatusBanner,
  useSharedStockfishRuntime,
} from '@/lib/engines/runtime';
import {
  EndgameTrainingSession,
  getPositionById,
  getShowGauge,
  setShowGauge,
  recordFinishedAttempt,
  addToTryAgain,
  removeFromTryAgain,
  isInTryAgain,
  getPositionStats,
  openEndgameInReader,
  getFinishedIds,
  getTryAgainIds,
  progressiveDeteriorationMessage,
  type SessionSnapshot,
  type PositionAttemptStats,
} from '@/lib/endgameTraining';
import {
  pickNewPositionAvoiding,
  pickTryAgainPositionAvoiding,
} from '@/lib/endgameTraining/selection/selectors';
import { canOfferFinishGame } from '@/lib/endgameTraining/domain/officialResultMessages';
import { formatDrawAlternativesMessage } from '@/lib/endgameTraining/domain/drawAlternatives';
import { PressureGauge } from '@/lib/endgameTraining/ui/PressureGauge';
import { EvaluationCurve } from '@/lib/endgameTraining/ui/EvaluationCurve';
import type {
  FinishGamePayload,
  ReviewLaunchPayload,
} from '@/lib/review/ReviewSessionRegistry';

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export default function EndgameTrainingPlayScreen() {
  const { positionId, source } = useLocalSearchParams<{
    positionId: string;
    source?: string;
  }>();
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { inputMode, toggleChessInputMode, keypadActive } = useChessInputMode();

  const sessionRef = useRef(new EndgameTrainingSession({}));
  const [snap, setSnap] = useState<SessionSnapshot>(() => sessionRef.current.snapshot());
  const [draftMove, setDraftMove] = useState('');
  const [busy, setBusy] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [showGauge, setShowGaugeState] = useState(true);
  const [inTryAgain, setInTryAgain] = useState(false);
  const [stats, setStats] = useState<PositionAttemptStats | null>(null);
  const [addedTryAgain, setAddedTryAgain] = useState(false);
  const [tryAgainPromptVisible, setTryAgainPromptVisible] = useState(false);
  const [tryAgainPromptAnswered, setTryAgainPromptAnswered] = useState(false);
  const [overlay, setOverlay] = useState<ResultOverlayKind>(null);
  const startedRef = useRef(false);
  const recordedRef = useRef(false);

  const {
    snapshot: engineSnap,
    engineReady,
    retry: retryEngine,
    runtime,
  } = useSharedStockfishRuntime();

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(wide, windowHeight, 360);
  }, [windowWidth, windowHeight]);

  useEffect(() => {
    void getShowGauge().then(setShowGaugeState);
    return () => {
      sessionRef.current.setAnalyzer(null);
      const cur = sessionRef.current.snapshot();
      if (
        cur.phase === 'playing' ||
        cur.phase === 'thinking' ||
        cur.phase === 'verifying-loss'
      ) {
        sessionRef.current.abandon();
      }
    };
  }, []);

  useEffect(() => {
    if (!engineReady) return;
    const service = runtime.getService();
    if (service) sessionRef.current.setAnalyzer(service);
  }, [engineReady, runtime]);

  useEffect(() => {
    startedRef.current = false;
    setPositionReady(false);
    setPositionMissing(false);
    recordedRef.current = false;
    setTryAgainPromptAnswered(false);
    setTryAgainPromptVisible(false);
    setOverlay(null);
  }, [positionId]);

  const refresh = useCallback((next: SessionSnapshot) => {
    setSnap(next);
  }, []);

  useEffect(() => {
    if (startedRef.current || !positionId) return;
    const pos = getPositionById(String(positionId));
    if (!pos) {
      setPositionMissing(true);
      return;
    }
    startedRef.current = true;
    void (async () => {
      setBusy(true);
      try {
        refresh(await sessionRef.current.start(pos));
        setPositionReady(true);
        setInTryAgain(await isInTryAgain(pos.id));
        setStats(await getPositionStats(pos.id));
      } finally {
        setBusy(false);
      }
    })();
  }, [positionId, refresh]);

  useEffect(() => {
    if (!snap.result || recordedRef.current) return;
    if (
      snap.result.outcome !== 'loss' &&
      snap.result.outcome !== 'win-30-moves' &&
      snap.result.outcome !== 'win-official-draw'
    ) {
      return;
    }
    recordedRef.current = true;
    void recordFinishedAttempt(snap.result, {
      family: snap.position?.family,
      materialSignature: snap.position?.materialSignature,
    }).then(setStats);
  }, [snap.result, snap.position]);

  const showResult =
    snap.phase === 'lost' ||
    snap.phase === 'won-30' ||
    snap.phase === 'won-draw';

  useEffect(() => {
    if (!showResult || tryAgainPromptAnswered) return;
    if (inTryAgain || addedTryAgain) return;
    setTryAgainPromptVisible(true);
  }, [showResult, tryAgainPromptAnswered, inTryAgain, addedTryAgain]);

  const toggleGauge = async () => {
    const next = !showGauge;
    setShowGaugeState(next);
    await setShowGauge(next);
  };

  const playUserMove = async (from: string, to: string, promotion?: string) => {
    if (busy || !engineReady) return;
    if (
      snap.phase !== 'playing' &&
      snap.phase !== 'off-score' &&
      snap.phase !== 'finish-game'
    ) {
      return;
    }
    setBusy(true);
    try {
      refresh(await sessionRef.current.attemptMove(from, to, promotion ?? 'q'));
    } finally {
      setBusy(false);
    }
  };

  const submitSan = async (raw: string) => {
    if (busy || !engineReady) return;
    if (
      snap.phase !== 'playing' &&
      snap.phase !== 'off-score' &&
      snap.phase !== 'finish-game'
    ) {
      return;
    }
    setBusy(true);
    try {
      refresh(await sessionRef.current.answerSan(raw));
    } finally {
      setBusy(false);
    }
  };

  const thinking =
    busy ||
    snap.phase === 'thinking' ||
    snap.phase === 'verifying-loss' ||
    engineSnap.status === 'thinking';

  const canMove =
    engineReady &&
    !thinking &&
    (snap.phase === 'playing' ||
      snap.phase === 'off-score' ||
      snap.phase === 'finish-game');

  const { touchSelected, legalDests, onSquarePress } = useExerciseBoardTouch({
    canAct: canMove,
    getLegalDestinations: (from) => sessionRef.current.getLegalDestinations(from),
    onMove: playUserMove,
    onSan: submitSan,
  });

  const speech = useExerciseSpeechInput({
    enabled: inputMode === 'classic' && canMove,
    onSan: submitSan,
  });

  const board = useMemo(() => boardFromFen(snap.fen), [snap.fen]);

  const gameOver = useMemo(() => {
    try {
      return new Chess(snap.fen).isGameOver();
    } catch {
      return true;
    }
  }, [snap.fen]);

  const showFinishGame =
    showResult &&
    !snap.finishGameActive &&
    snap.result &&
    canOfferFinishGame({
      scoreLocked: snap.scoreLocked,
      gameOver,
      outcome: snap.result.outcome,
      phase: snap.phase,
    });

  const analysisPayload: ReviewLaunchPayload | null = useMemo(() => {
    if (!snap.result || !snap.position) return null;
    return {
      mode: 'defend-draw',
      startFen: snap.result.startFen,
      orientation: snap.position.defender,
      moveSans: snap.result.moveSans,
      timeline: snap.result.timeline,
      firstMajorTurn: snap.result.firstMajorTurn,
      positionId: snap.position.id,
      lossThresholdCp: -200,
    };
  }, [snap.result, snap.position]);

  const finishPayload: FinishGamePayload | null = useMemo(() => {
    if (!snap.result || !snap.position) return null;
    return {
      fen: snap.fen,
      orientation: snap.position.defender,
      moveSans: snap.moveSans,
      lockedOutcome: snap.result.outcome,
      positionId: snap.position.id,
      mode: 'defend-draw',
    };
  }, [snap.result, snap.position, snap.fen, snap.moveSans]);

  const drawAltMessage = useMemo(() => {
    if (!snap.result || snap.result.outcome !== 'loss') return null;
    if (snap.result.drawAlternativesReliable === false) {
      return formatDrawAlternativesMessage(
        {
          fenBeforeLoss: snap.result.fenBeforeLoss ?? '',
          losingSan: snap.result.losingSan ?? '',
          evalBeforeCp: snap.result.evalBeforeLossCp ?? 0,
          evalAfterCp: snap.result.evalAfterLossCp ?? 0,
          alternatives: (snap.result.drawAlternatives ?? []).map((a, i) => ({
            san: a.san,
            uci: '',
            scoreCp: a.scoreCp,
            mateIn: null,
            rank: i + 1,
          })),
          hasMoreAlternatives: snap.result.drawAlternativesHasMore ?? false,
          reliable: false,
        },
        (san) => formatSanForDisplay(san, chessNotation),
      );
    }
    if (!snap.result.drawAlternatives?.length) return null;
    return formatDrawAlternativesMessage(
      {
        fenBeforeLoss: snap.result.fenBeforeLoss ?? '',
        losingSan: snap.result.losingSan ?? '',
        evalBeforeCp: snap.result.evalBeforeLossCp ?? 0,
        evalAfterCp: snap.result.evalAfterLossCp ?? 0,
        alternatives: snap.result.drawAlternatives.map((a, i) => ({
          san: a.san,
          uci: '',
          scoreCp: a.scoreCp,
          mateIn: null,
          rank: i + 1,
        })),
        hasMoreAlternatives: snap.result.drawAlternativesHasMore ?? false,
        reliable: true,
      },
      (san) => formatSanForDisplay(san, chessNotation),
    );
  }, [snap.result, chessNotation]);

  const handleAddTryAgain = async () => {
    if (!snap.position) return;
    await addToTryAgain(snap.position.id);
    setAddedTryAgain(true);
    setInTryAgain(true);
  };

  const handleRemoveTryAgain = async () => {
    if (!snap.position) return;
    await removeFromTryAgain(snap.position.id);
    setInTryAgain(false);
    setAddedTryAgain(false);
  };

  const handleRetry = async () => {
    recordedRef.current = false;
    setAddedTryAgain(false);
    setTryAgainPromptAnswered(false);
    setOverlay(null);
    setBusy(true);
    try {
      refresh(await sessionRef.current.retry());
      if (snap.position) setStats(await getPositionStats(snap.position.id));
    } finally {
      setBusy(false);
    }
  };

  const handleNextPosition = async () => {
    if (!snap.position) return;
    const avoidId = snap.position.id;
    let next = null;
    if (source === 'try-again') {
      const ids = await getTryAgainIds();
      next = pickTryAgainPositionAvoiding(ids, avoidId);
    } else {
      const finished = await getFinishedIds();
      next = pickNewPositionAvoiding(new Set(finished), avoidId);
    }
    if (!next) {
      router.replace('/puzzles/defends-nulle' as Href);
      return;
    }
    router.replace(
      `/puzzles/defends-nulle-play?positionId=${encodeURIComponent(next.id)}&source=${source ?? 'new'}` as Href,
    );
  };

  const handleTryAgainPromptYes = async () => {
    setTryAgainPromptAnswered(true);
    setTryAgainPromptVisible(false);
    await handleAddTryAgain();
  };

  const handleTryAgainPromptNo = () => {
    setTryAgainPromptAnswered(true);
    setTryAgainPromptVisible(false);
  };

  if (positionMissing) {
    return (
      <ChessScreenScaffold
        title={t('quiz.defendsNullePageTitle')}
        onBack={() => router.back()}
        testID="endgame-training-play"
      >
        <View style={styles.missingBox}>
          <Text style={{ color: colors.foreground }} testID="endgame-position-missing">
            {t('quiz.positionNotFound')}
          </Text>
          <AppButton
            label={t('quiz.stockfishBack')}
            onPress={() => router.back()}
            variant="secondary"
            testID="endgame-position-missing-back"
          />
        </View>
      </ChessScreenScaffold>
    );
  }

  if (!positionReady) {
    return (
      <ChessScreenScaffold
        title={t('quiz.defendsNullePageTitle')}
        onBack={() => router.back()}
        testID="endgame-training-play"
      >
        <View style={styles.busyRow} testID="endgame-position-loading">
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground }}>{t('quiz.defendsNulleLoading')}</Text>
        </View>
      </ChessScreenScaffold>
    );
  }

  const playerPerspective = snap.position?.defender ?? 'white';

  return (
    <>
      <ChessScreenScaffold
        title={t('quiz.defendsNullePageTitle')}
        onBack={() => router.back()}
        testID="endgame-training-play"
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {snap.position && (
            <PositionReferenceBadge
              id={snap.position.id}
              sourceId={snap.position.source.sourceId}
              provider={snap.position.source.provider}
            />
          )}

          <View style={styles.topRow}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: DesignTokens.typography.weightSemiBold,
              }}
              testID="endgame-moves-resisted"
            >
              {t('quiz.endgameMovesResisted', { count: snap.movesResisted })}
            </Text>
            <Pressable
              onPress={() => void toggleGauge()}
              hitSlop={8}
              testID="endgame-gauge-toggle"
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {showGauge ? t('quiz.endgameHideGauge') : t('quiz.endgameShowGauge')}
              </Text>
            </Pressable>
          </View>

          <PressureGauge
            scoreCp={snap.evalCp}
            mateIn={snap.mateIn}
            visible={showGauge}
            perspective={playerPerspective}
          />

          {snap.finishGameActive && (
            <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
              Finir la partie
            </Text>
          )}

          <ChessBoardSection
            boardSize={boardSize}
            style={{ gap: 8, alignSelf: 'center' }}
            toolbar={
              <BoardToolbar
                label={
                  snap.defender === 'w'
                    ? t('puzzle.youPlayWhite')
                    : t('puzzle.youPlayBlack')
                }
                showCoordinates={showCoordinates}
                onToggleCoordinates={() => void toggleCoordinates()}
              />
            }
            testID="endgame-board"
          >
            <ChessBoard
              board={board}
              lastMove={snap.lastMove as LastMove | null}
              isFlipped={snap.defender === 'b'}
              selectedSquare={touchSelected}
              legalDots={legalDests}
              onSquarePress={onSquarePress}
              showCoordinates={showCoordinates}
              sizeMode="wide"
              size={boardSize}
            />
          </ChessBoardSection>

          <EndgameEngineStatusBanner
            snapshot={engineSnap}
            onRetry={() => void retryEngine()}
            onBack={() => router.back()}
          />

          {thinking && engineReady && (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.mutedForeground }}>
                {snap.phase === 'verifying-loss'
                  ? t('quiz.endgameVerifying')
                  : t('quiz.defendsNulleReflecting')}
              </Text>
            </View>
          )}

          {!!snap.lastFeedback && !showResult && (
            <Text
              style={{
                color: colors.foreground,
                fontFamily: DesignTokens.typography.weightSemiBold,
              }}
              testID="endgame-feedback"
            >
              {snap.lastFeedback}
            </Text>
          )}

          {canMove && (
            <View style={styles.inputBlock}>
              {inputMode === 'classic' && (
                <GameMicButton
                  showRecognized={speech.showRecognized}
                  isListening={speech.listening}
                  micActive={speech.micActive}
                  onToggle={() => speech.toggleListening()}
                  testID="endgame-mic"
                />
              )}
              <ChessKeyboardToggle
                variant="classic"
                active={keypadActive}
                onToggle={() => void toggleChessInputMode()}
              />
              {keypadActive ? (
                <ChessMoveKeypad
                  fen={snap.fen}
                  value={draftMove}
                  onChangeText={setDraftMove}
                  onSubmit={(raw) => {
                    setDraftMove('');
                    void submitSan(raw);
                  }}
                  testID="endgame-move-keypad"
                />
              ) : (
                <ChessMoveInput
                  inputType="chess-move"
                  fen={snap.fen}
                  onSubmit={(raw) => void submitSan(raw)}
                  enabled
                  autoSubmit
                  testID="endgame-move-input"
                />
              )}
            </View>
          )}

          {showResult && snap.result && (
            <View style={styles.result} testID="endgame-result">
              {snap.position && (
                <PositionReferenceBadge
                  id={snap.position.id}
                  sourceId={snap.position.source.sourceId}
                  provider={snap.position.source.provider}
                />
              )}

              <Text
                style={{
                  color:
                    snap.phase === 'lost'
                      ? '#c44'
                      : '#398a55',
                  fontFamily: DesignTokens.typography.weightSemiBold,
                  textAlign: 'center',
                }}
                testID="endgame-official-result"
              >
                {snap.officialResultMessage ??
                  snap.lastFeedback ??
                  snap.result.officialResultMessage}
              </Text>

              {snap.phase === 'lost' && (
                <>
                  <EvaluationCurve
                    timeline={snap.timeline}
                    firstMajorTurn={snap.result.firstMajorTurn}
                  />
                  <Text style={{ color: colors.foreground }}>
                    {sessionRef.current.getFirstMajorTurnMessage() ||
                      progressiveDeteriorationMessage()}
                  </Text>
                  {drawAltMessage && (
                    <Text style={{ color: colors.foreground }} testID="endgame-draw-alternatives">
                      {drawAltMessage}
                    </Text>
                  )}
                </>
              )}

              {stats && stats.attemptsFinished > 1 && (
                <View style={styles.statsBox}>
                  <Text style={{ color: colors.mutedForeground }}>
                    {t('quiz.endgameThisAttempt', { count: snap.movesResisted })}
                  </Text>
                  {stats.recent[1] && (
                    <Text style={{ color: colors.mutedForeground }}>
                      {t('quiz.endgamePrevAttempt', {
                        count: stats.recent[1].movesResisted,
                      })}
                    </Text>
                  )}
                  {stats.bestResisted != null && (
                    <Text style={{ color: colors.mutedForeground }}>
                      {t('quiz.endgameBestAttempt', { count: stats.bestResisted })}
                    </Text>
                  )}
                </View>
              )}

              <AppButton
                label={t('quiz.endgameAnalyse')}
                onPress={() => {
                  if (!snap.result || !snap.position || busy) return;
                  setBusy(true);
                  void openEndgameInReader({
                    result: snap.result,
                    defender: snap.position.defender,
                    routerPush: (href) => router.push(href as Href),
                  }).finally(() => setBusy(false));
                }}
                testID="endgame-analyse"
              />

              {snap.phase === 'lost' && (
                <>
                  {!inTryAgain && !addedTryAgain ? (
                    <AppButton
                      label={t('quiz.endgameAddTryAgain')}
                      onPress={() => void handleAddTryAgain()}
                      variant="secondary"
                      testID="endgame-add-try-again"
                    />
                  ) : (
                    <Text style={{ color: '#398a55' }} testID="endgame-added-try-again">
                      {t('quiz.endgameAddedTryAgain')}
                    </Text>
                  )}
                  <AppButton
                    label={t('quiz.endgameRetry')}
                    onPress={() => void handleRetry()}
                    testID="endgame-retry"
                  />
                </>
              )}

              {showFinishGame && (
                <AppButton
                  label="Finir la partie"
                  onPress={() => setOverlay('finish-game')}
                  variant="secondary"
                  testID="endgame-finish-game"
                />
              )}

              <AppButton
                label="Défendre la finale suivante"
                onPress={() => void handleNextPosition()}
                testID="endgame-next-position"
              />

              {source === 'try-again' && inTryAgain && (
                <Pressable onPress={() => void handleRemoveTryAgain()} style={styles.subtle}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                    {t('quiz.endgameRemoveTryAgain')}
                  </Text>
                </Pressable>
              )}

              <AppButton
                label={t('quiz.endgameBackMenu')}
                onPress={() => router.replace('/puzzles/defends-nulle' as Href)}
                variant="secondary"
                testID="endgame-back-menu"
              />
            </View>
          )}
        </ScrollView>
      </ChessScreenScaffold>

      <TryAgainPromptModal
        visible={tryAgainPromptVisible && !tryAgainPromptAnswered}
        alreadyInPool={inTryAgain || addedTryAgain}
        onYes={() => void handleTryAgainPromptYes()}
        onNo={handleTryAgainPromptNo}
      />

      <ExerciseResultOverlayHost
        overlay={overlay}
        analysisPayload={analysisPayload}
        finishPayload={finishPayload}
        onCloseOverlay={() => setOverlay(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: DesignTokens.spacing.md,
    paddingBottom: DesignTokens.spacing.xl,
    alignItems: 'stretch',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputBlock: { gap: DesignTokens.spacing.sm, alignItems: 'center' },
  result: { gap: DesignTokens.spacing.sm },
  statsBox: { gap: 2 },
  subtle: { alignSelf: 'center', paddingVertical: 8 },
  missingBox: { gap: DesignTokens.spacing.md, paddingVertical: DesignTokens.spacing.lg },
});
