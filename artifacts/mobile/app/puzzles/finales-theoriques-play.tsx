/**
 * Play / result — Finales théoriques (shared Classic UI + overlays).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  ExerciseResultOverlayHost,
  type ResultOverlayKind,
} from '@/components/review/ExerciseResultOverlayHost';
import { useColors } from '@/hooks/useColors';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useTranslation } from '@/hooks/useTranslation';
import { useChessInputMode } from '@/hooks/useChessInputMode';
import {
  useExerciseBoardTouch,
  useExerciseSpeechInput,
} from '@/hooks/useExerciseChessInput';
import { DesignTokens } from '@/constants/designTokens';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import {
  EndgameEngineStatusBanner,
  useSharedStockfishRuntime,
} from '@/lib/engines/runtime';
import {
  TheoreticalEndgameSession,
  getPositionById,
  getTheme,
  recordAttempt,
  formatComprehensionScore,
  pickPositionInTheme,
  type SessionSnapshot,
} from '@/lib/theoreticalEndgame';
import { canOfferTheoreticalFinishGame } from '@/lib/theoreticalEndgame/domain/officialResultMessages';
import type {
  FinishGamePayload,
  ReviewLaunchPayload,
} from '@/lib/review/ReviewSessionRegistry';
import type { MessageKey } from '@/lib/i18n';

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

function themeTitleKey(titleKey: string): MessageKey {
  return `quiz.theoreticalTheme${titleKey}` as MessageKey;
}

export default function TheoreticalEndgamePlayScreen() {
  const { positionId, themeId } = useLocalSearchParams<{
    positionId: string;
    themeId?: string;
  }>();
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { inputMode, toggleChessInputMode, keypadActive } = useChessInputMode();

  const sessionRef = useRef(new TheoreticalEndgameSession());
  const [snap, setSnap] = useState<SessionSnapshot>(() => sessionRef.current.snapshot());
  const [draftMove, setDraftMove] = useState('');
  const [busy, setBusy] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [scoreDelta, setScoreDelta] = useState<{ old: number; new: number; count: number } | null>(
    null,
  );
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
    return () => {
      sessionRef.current.setAnalyzer(null);
      const cur = sessionRef.current.snapshot();
      if (
        cur.phase === 'playing' ||
        cur.phase === 'thinking' ||
        cur.phase === 'verifying'
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
    setScoreDelta(null);
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
      } finally {
        setBusy(false);
      }
    })();
  }, [positionId, refresh]);

  useEffect(() => {
    if (!snap.result || recordedRef.current) return;
    if (snap.result.outcome !== 'success' && snap.result.outcome !== 'theoretical-loss') return;
    recordedRef.current = true;
    void recordAttempt(snap.result).then((d) =>
      setScoreDelta({ old: d.oldScore, new: d.newScore, count: d.count }),
    );
  }, [snap.result]);

  const confirmExit = () => {
    if (snap.phase !== 'playing' && snap.phase !== 'thinking' && snap.phase !== 'verifying') {
      router.back();
      return;
    }
    Alert.alert(
      t('quiz.theoreticalExitTitle'),
      t('quiz.theoreticalExitBody'),
      [
        { text: t('quiz.theoreticalExitContinue'), style: 'cancel' },
        {
          text: t('quiz.theoreticalExitConfirm'),
          style: 'destructive',
          onPress: () => {
            sessionRef.current.abandon();
            router.back();
          },
        },
      ],
    );
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
    snap.phase === 'verifying' ||
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

  const theme = snap.position ? getTheme(snap.position.themeId) : null;
  const themeTitle = theme ? t(themeTitleKey(theme.titleKey)) : '';
  const objectiveLabel =
    snap.objective === 'WIN'
      ? t('quiz.theoreticalObjectiveWin')
      : t('quiz.theoreticalObjectiveDraw');

  const showResult = snap.phase === 'success' || snap.phase === 'theoretical-loss';
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
    canOfferTheoreticalFinishGame({
      scoreLocked: snap.scoreLocked,
      gameOver,
      finishGameActive: snap.finishGameActive,
      phase: snap.phase,
    });

  const analysisPayload: ReviewLaunchPayload | null = useMemo(() => {
    if (!snap.result || !snap.position) return null;
    return {
      mode: 'theoretical',
      startFen: snap.result.startFen,
      orientation: snap.position.playerColor,
      moveSans: snap.result.moveSans,
      timeline: [],
      positionId: snap.position.id,
      themeId: snap.position.themeId,
      objective: snap.position.objective,
    };
  }, [snap.result, snap.position]);

  const finishPayload: FinishGamePayload | null = useMemo(() => {
    if (!snap.result || !snap.position) return null;
    return {
      fen: snap.fen,
      orientation: snap.position.playerColor,
      moveSans: snap.moveSans,
      lockedOutcome: snap.result.outcome,
      positionId: snap.position.id,
      mode: 'theoretical',
    };
  }, [snap.result, snap.position, snap.fen, snap.moveSans]);

  const handleRetry = async () => {
    recordedRef.current = false;
    setScoreDelta(null);
    setOverlay(null);
    setBusy(true);
    try {
      refresh(await sessionRef.current.retry());
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    const tid = (themeId ?? snap.position?.themeId) as import('@/lib/theoreticalEndgame').TheoreticalThemeId;
    if (!tid) return;
    const next = pickPositionInTheme(tid, snap.position?.id ?? null);
    if (!next) {
      router.replace('/puzzles/finales-theoriques' as Href);
      return;
    }
    recordedRef.current = false;
    setScoreDelta(null);
    startedRef.current = false;
    router.replace(
      `/puzzles/finales-theoriques-play?positionId=${encodeURIComponent(next.id)}&themeId=${encodeURIComponent(tid)}` as Href,
    );
  };

  if (positionMissing) {
    return (
      <ChessScreenScaffold
        title={themeTitle || t('quiz.theoreticalEndgameTitle')}
        onBack={confirmExit}
        testID="theoretical-endgame-play"
      >
        <View style={styles.missingBox}>
          <Text style={{ color: colors.foreground }} testID="theoretical-position-missing">
            {t('quiz.positionNotFound')}
          </Text>
          <AppButton
            label={t('quiz.stockfishBack')}
            onPress={() => router.back()}
            variant="secondary"
            testID="theoretical-position-missing-back"
          />
        </View>
      </ChessScreenScaffold>
    );
  }

  if (!positionReady) {
    return (
      <ChessScreenScaffold
        title={themeTitle || t('quiz.theoreticalEndgameTitle')}
        onBack={confirmExit}
        testID="theoretical-endgame-play"
      >
        <View style={styles.busyRow} testID="theoretical-position-loading">
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground }}>{t('quiz.defendsNulleLoading')}</Text>
        </View>
      </ChessScreenScaffold>
    );
  }

  return (
    <>
      <ChessScreenScaffold
        title={themeTitle}
        subtitle={objectiveLabel}
        onBack={confirmExit}
        testID="theoretical-endgame-play"
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {snap.position && !showResult && (
            <PositionReferenceBadge id={snap.position.id} />
          )}

          {snap.finishGameActive && (
            <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
              Finir la partie
            </Text>
          )}

          <Text style={{ color: colors.mutedForeground, fontSize: 13 }} testID="theoretical-move-count">
            {t('quiz.theoreticalMovesPlayed', { count: snap.userMoves, target: snap.targetUserMoves })}
          </Text>

          <ChessBoardSection
            boardSize={boardSize}
            style={{ gap: 8, alignSelf: 'center' }}
            toolbar={
              <BoardToolbar
                label={
                  snap.playerColor === 'w'
                    ? t('puzzle.youPlayWhite')
                    : t('puzzle.youPlayBlack')
                }
                showCoordinates={showCoordinates}
                onToggleCoordinates={() => void toggleCoordinates()}
              />
            }
            testID="theoretical-board"
          >
            <ChessBoard
              board={board}
              lastMove={snap.lastMove as LastMove | null}
              isFlipped={snap.playerColor === 'b'}
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
            onBack={confirmExit}
          />

          {thinking && engineReady && (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.mutedForeground }}>
                {snap.phase === 'verifying'
                  ? t('quiz.theoreticalVerifying')
                  : t('quiz.defendsNulleReflecting')}
              </Text>
            </View>
          )}

          {!!snap.lastFeedback && !showResult && (
            <Text
              style={{
                color:
                  snap.phase === 'theoretical-loss'
                    ? '#c44'
                    : snap.phase === 'success'
                      ? '#398a55'
                      : colors.foreground,
                fontFamily: DesignTokens.typography.weightSemiBold,
              }}
              testID="theoretical-feedback"
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
                  testID="theoretical-mic"
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
                  testID="theoretical-move-keypad"
                />
              ) : (
                <ChessMoveInput
                  inputType="chess-move"
                  fen={snap.fen}
                  onSubmit={(raw) => void submitSan(raw)}
                  enabled
                  autoSubmit
                  testID="theoretical-move-input"
                />
              )}
            </View>
          )}

          {showResult && snap.result && (
            <View style={styles.result} testID="theoretical-result">
              {snap.position && (
                <PositionReferenceBadge id={snap.position.id} />
              )}

              <Text
                style={{
                  color: snap.phase === 'theoretical-loss' ? '#c44' : '#398a55',
                  fontFamily: DesignTokens.typography.weightSemiBold,
                  textAlign: 'center',
                }}
                testID="theoretical-official-result"
              >
                {snap.result.officialResultMessage ??
                  snap.officialResultMessage ??
                  snap.lastFeedback}
              </Text>

              {snap.result.firstTheoreticalLoss && snap.phase === 'theoretical-loss' && (
                <Text style={{ color: colors.foreground }}>
                  {snap.result.firstTheoreticalLoss.message}
                </Text>
              )}

              {scoreDelta && (
                <View style={styles.statsBox}>
                  <Text style={{ color: colors.mutedForeground }}>
                    {t('quiz.theoreticalScoreOld', { score: formatComprehensionScore(scoreDelta.old) })}
                  </Text>
                  <Text style={{ color: colors.foreground }}>
                    {t('quiz.theoreticalScoreNew', { score: formatComprehensionScore(scoreDelta.new) })}
                  </Text>
                  {scoreDelta.count < 10 && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('quiz.theoreticalScoreAttempts', { count: scoreDelta.count })}
                    </Text>
                  )}
                </View>
              )}

              <AppButton
                label={t('quiz.theoreticalAnalyse')}
                onPress={() => setOverlay('analysis')}
                testID="theoretical-analyse"
              />
              <AppButton
                label={t('quiz.theoreticalRetry')}
                onPress={() => void handleRetry()}
                variant="secondary"
                testID="theoretical-retry"
              />

              {showFinishGame && (
                <AppButton
                  label="Finir la partie"
                  onPress={() => setOverlay('finish-game')}
                  variant="secondary"
                  testID="theoretical-finish-game"
                />
              )}

              <AppButton
                label={t('quiz.theoreticalNext')}
                onPress={() => void handleNext()}
                testID="theoretical-next"
              />

              <AppButton
                label={t('quiz.theoreticalBackThemes')}
                onPress={() => router.replace('/puzzles/finales-theoriques' as Href)}
                variant="secondary"
                testID="theoretical-back-themes"
              />
            </View>
          )}
        </ScrollView>
      </ChessScreenScaffold>

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
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputBlock: { gap: DesignTokens.spacing.sm, alignItems: 'center' },
  result: { gap: DesignTokens.spacing.sm },
  statsBox: { gap: 2 },
  missingBox: { gap: DesignTokens.spacing.md, paddingVertical: DesignTokens.spacing.lg },
});
