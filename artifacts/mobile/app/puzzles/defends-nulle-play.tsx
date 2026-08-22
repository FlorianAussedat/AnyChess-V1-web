/**
 * Play / result screen for Entraînement aux Finales.
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
import { BoardToolbar } from '@/components/BoardToolbar';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
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
  progressiveDeteriorationMessage,
  type SessionSnapshot,
  type PositionAttemptStats,
} from '@/lib/endgameTraining';
import { PressureGauge } from '@/lib/endgameTraining/ui/PressureGauge';
import { EvaluationCurve } from '@/lib/endgameTraining/ui/EvaluationCurve';
import { openEndgameInReader } from '@/lib/endgameTraining/review/EndgameAnalysisAdapter';

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
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();

  const sessionRef = useRef(new EndgameTrainingSession({}));
  const [snap, setSnap] = useState<SessionSnapshot>(() => sessionRef.current.snapshot());
  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [showGauge, setShowGaugeState] = useState(true);
  const [inTryAgain, setInTryAgain] = useState(false);
  const [stats, setStats] = useState<PositionAttemptStats | null>(null);
  const [addedTryAgain, setAddedTryAgain] = useState(false);
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
    return fitBoardSizeToViewport(wide, windowHeight, 320);
  }, [windowWidth, windowHeight]);

  useEffect(() => {
    void getShowGauge().then(setShowGaugeState);
    return () => {
      sessionRef.current.setAnalyzer(null);
      const cur = sessionRef.current.snapshot();
      if (cur.phase === 'playing' || cur.phase === 'thinking' || cur.phase === 'verifying-loss') {
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
  }, [positionId]);

  const refresh = useCallback((next: SessionSnapshot) => {
    setSnap(next);
    setSelected(null);
    setLegalDests([]);
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

  // Persist finished attempts once
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

  const toggleGauge = async () => {
    const next = !showGauge;
    setShowGaugeState(next);
    await setShowGauge(next);
  };

  const playUserMove = async (from: string, to: string) => {
    if (busy || !engineReady) return;
    if (snap.phase !== 'playing' && snap.phase !== 'off-score') return;
    setBusy(true);
    try {
      refresh(await sessionRef.current.attemptMove(from, to));
    } finally {
      setBusy(false);
    }
  };

  const submitSan = async (raw: string) => {
    if (busy || !engineReady) return;
    if (snap.phase !== 'playing' && snap.phase !== 'off-score') return;
    setBusy(true);
    try {
      refresh(await sessionRef.current.answerSan(raw));
    } finally {
      setBusy(false);
    }
  };

  const onSquarePress = (square: string) => {
    if (busy || !engineReady) return;
    if (snap.phase !== 'playing' && snap.phase !== 'off-score') return;
    if (selected === null) {
      const dests = sessionRef.current.getLegalDestinations(square);
      if (dests.length > 0) {
        setSelected(square);
        setLegalDests(dests);
      }
      return;
    }
    if (square === selected) {
      setSelected(null);
      setLegalDests([]);
      return;
    }
    if (legalDests.includes(square)) {
      void playUserMove(selected, square);
      return;
    }
    const dests = sessionRef.current.getLegalDestinations(square);
    if (dests.length > 0) {
      setSelected(square);
      setLegalDests(dests);
    } else {
      setSelected(null);
      setLegalDests([]);
    }
  };

  const board = useMemo(() => boardFromFen(snap.fen), [snap.fen]);
  const thinking =
    busy ||
    snap.phase === 'thinking' ||
    snap.phase === 'verifying-loss' ||
    engineSnap.status === 'thinking';
  const canMove =
    engineReady &&
    !thinking &&
    (snap.phase === 'playing' || snap.phase === 'off-score');
  const showResult =
    snap.phase === 'lost' ||
    snap.phase === 'won-30' ||
    snap.phase === 'won-draw';

  const handleAddTryAgain = async () => {
    if (!snap.position) return;
    const added = await addToTryAgain(snap.position.id);
    setAddedTryAgain(true);
    setInTryAgain(true);
    if (!added) setAddedTryAgain(true);
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
    setBusy(true);
    try {
      refresh(await sessionRef.current.retry());
      if (snap.position) setStats(await getPositionStats(snap.position.id));
    } finally {
      setBusy(false);
    }
  };

  const handleContinueOffScore = () => {
    refresh(sessionRef.current.continueOffScore());
  };

  const handleAnalyse = async () => {
    if (!snap.result || !snap.position) return;
    await openEndgameInReader({
      result: snap.result,
      defender: snap.position.defender,
      routerPush: (href) => router.push(href as Href),
    });
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

  return (
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
        <View style={styles.topRow}>
          <Text
            style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}
            testID="endgame-moves-resisted"
          >
            {t('quiz.endgameMovesResisted', { count: snap.movesResisted })}
          </Text>
          <Pressable onPress={() => void toggleGauge()} hitSlop={8} testID="endgame-gauge-toggle">
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
              {showGauge ? t('quiz.endgameHideGauge') : t('quiz.endgameShowGauge')}
            </Text>
          </Pressable>
        </View>

        <PressureGauge
          scoreCp={snap.evalCp}
          mateIn={snap.mateIn}
          visible={showGauge}
        />

        {snap.offScore && (
          <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
            {t('quiz.endgameOffScore')}
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
              onToggleCoordinates={() => {
                void toggleCoordinates();
              }}
            />
          }
          testID="endgame-board"
        >
          <ChessBoard
            board={board}
            lastMove={snap.lastMove as LastMove | null}
            isFlipped={snap.defender === 'b'}
            selectedSquare={selected}
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

        {!!snap.lastFeedback && (
          <Text
            style={{
              color:
                snap.phase === 'lost'
                  ? '#c44'
                  : snap.phase === 'won-30' || snap.phase === 'won-draw'
                    ? '#398a55'
                    : colors.foreground,
              fontFamily: DesignTokens.typography.weightSemiBold,
            }}
            testID="endgame-feedback"
          >
            {snap.lastFeedback}
          </Text>
        )}

        {canMove && (
          <ChessMoveInput
            inputType="chess-move"
            fen={snap.fen}
            onSubmit={(raw) => void submitSan(raw)}
            enabled
            autoSubmit
            testID="endgame-move-input"
          />
        )}

        {showResult && snap.result && (
          <View style={styles.result} testID="endgame-result">
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
              onPress={() => void handleAnalyse()}
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

            {(snap.phase === 'won-30' || snap.phase === 'lost') && !snap.offScore && (
              <AppButton
                label={
                  snap.phase === 'won-30'
                    ? t('quiz.endgameContinuePosition')
                    : t('quiz.endgameContinueOffScore')
                }
                onPress={handleContinueOffScore}
                variant="secondary"
                testID="endgame-continue-off-score"
              />
            )}

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
  result: { gap: DesignTokens.spacing.sm },
  statsBox: { gap: 2 },
  subtle: { alignSelf: 'center', paddingVertical: 8 },
  missingBox: { gap: DesignTokens.spacing.md, paddingVertical: DesignTokens.spacing.lg },
});
