/**
 * Play / result — Finales théoriques (shared Classic UI + overlays).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { usePersistedActivity } from '@/hooks/usePersistedActivity';
import { useActiveSessionBack } from '@/hooks/useActiveSessionBack';
import { Chess } from 'chess.js';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessBoard } from '@/components/ChessBoard';
import { ClassicCommandInputChrome } from '@/components/game/ClassicCommandInputChrome';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { AppButton } from '@/components/ui/AppButton';
import { PositionReferenceBadge } from '@/components/exercise/PositionReferenceBadge';
import {
  ExerciseResultOverlayHost,
  type ResultOverlayKind,
} from '@/components/review/ExerciseResultOverlayHost';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { useChessInputMode } from '@/hooks/useChessInputMode';
import {
  useExerciseBoardTouch,
  useExerciseSpeechInput,
} from '@/hooks/useExerciseChessInput';
import { DesignTokens } from '@/constants/designTokens';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import { pairMoveHistory } from '@/lib/game';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import {
  EndgameEngineStatusBanner,
  useSharedStockfishRuntime,
} from '@/lib/engines/runtime';
import {
  TheoreticalEndgameSession,
  getPositionById,
  getTheme,
  getAttempt,
  getThemeComprehension,
  recordAttempt,
  updateAttemptGrade,
  runPostGameGrade,
  resumePendingGrades,
  claimEngineForPlay,
  releaseEngineFromPlay,
  formatDuration,
  headlineFor,
  pickPositionInTheme,
  openTheoreticalInReader,
  type SessionSnapshot,
  type AnalysisStatus,
  type GradeConfidence,
  type RecordedAttemptDelta,
  type TheoreticalAttemptResult,
} from '@/lib/theoreticalEndgame';
import { movesToAnnounce } from '@/lib/theoreticalEndgame/voice/announceMoves';
import { TheoreticalResultCard } from '@/lib/theoreticalEndgame/ui/TheoreticalResultCard';
import { TheoreticalAttemptNote } from '@/lib/theoreticalEndgame/ui/TheoreticalAttemptNote';
import { sanToVerbal } from '@/lib/chessParser';
import { speechService } from '@/services/SpeechService';
import { canOfferTheoreticalFinishGame } from '@/lib/theoreticalEndgame/domain/officialResultMessages';
import type {
  FinishGamePayload,
  ReviewLaunchPayload,
} from '@/lib/review/ReviewSessionRegistry';
import type { MessageKey } from '@/lib/i18n';

const CLASSIC_BOARD_RESERVED_CHROME = 340;

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

function themeTitleKey(titleKey: string): MessageKey {
  return `quiz.theoreticalTheme${titleKey}` as MessageKey;
}

type ScoreView = {
  oldScore: number;
  newScore: number;
  count: number;
  estimatedScore: number;
  estimatedCount: number;
  attemptCount: number;
  winCount: number;
  attemptScore: number | null;
  analysisStatus: AnalysisStatus;
  gradeConfidence: GradeConfidence;
};

function viewFromDelta(delta: RecordedAttemptDelta): ScoreView {
  return {
    oldScore: delta.oldScore,
    newScore: delta.newScore,
    count: delta.count,
    estimatedScore: delta.estimatedScore,
    estimatedCount: delta.estimatedCount,
    attemptCount: delta.attemptCount,
    winCount: delta.winCount,
    attemptScore: delta.attemptScore,
    analysisStatus: delta.analysisStatus,
    gradeConfidence: delta.gradeConfidence,
  };
}

export default function TheoreticalEndgamePlayScreen() {
  const { positionId, themeId, sessionId: resumeParam } = useLocalSearchParams<{
    positionId: string;
    themeId?: string;
    sessionId?: string;
  }>();
  const colors = useColors();
  const { t, language } = useTranslation();
  const router = useRouter();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { chessNotation, voiceEnabled } = usePreferences();
  const { inputMode, setChessInputMode, keypadActive } = useChessInputMode();

  const sessionRef = useRef(new TheoreticalEndgameSession());
  const [snap, setSnap] = useState<SessionSnapshot>(() => sessionRef.current.snapshot());
  const [draftMove, setDraftMove] = useState('');
  const [busy, setBusy] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [scoreDelta, setScoreDelta] = useState<ScoreView | null>(null);
  const playClaimRef = useRef(0);
  const gradingKeyRef = useRef<string | null>(null);
  const [overlay, setOverlay] = useState<ResultOverlayKind>(null);
  const startedRef = useRef(false);
  const restoredRef = useRef(false);
  const recordedRef = useRef(false);
  const [boardVisible, setBoardVisible] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const spokenThrough = useRef(0);
  const spokenGeneration = useRef(0);

  const { sessionId } = usePersistedActivity({
    kind: 'theoretical-endgame',
    modeId: 'puzzles',
    resumeSessionId: typeof resumeParam === 'string' ? resumeParam : undefined,
    title: t('quiz.theoreticalEndgameTitle'),
    summary: String(positionId ?? ''),
    routeFor: (id) =>
      `/puzzles/finales-theoriques-play?positionId=${encodeURIComponent(String(positionId ?? ''))}${
        themeId ? `&themeId=${encodeURIComponent(String(themeId))}` : ''
      }&sessionId=${encodeURIComponent(id)}`,
    enabled:
      positionReady &&
      (snap.phase === 'playing' || snap.phase === 'thinking' || snap.phase === 'verifying'),
    revision: `${snap.phase}|${snap.fen}|${snap.userMoves}|${boardVisible}`,
    capture: () => ({ ...sessionRef.current.snapshot(), boardVisible }),
    apply: (payload) => {
      const data = payload as SessionSnapshot & { boardVisible?: boolean };
      if (!data?.fen || !data.position) return;
      restoredRef.current = true;
      startedRef.current = true;
      setBoardVisible(data.boardVisible !== false);
      refresh(sessionRef.current.restore(data));
      setPositionReady(true);
    },
  });

  const {
    snapshot: engineSnap,
    engineReady,
    retry: retryEngine,
    runtime,
  } = useSharedStockfishRuntime();

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      CLASSIC_BOARD_RESERVED_CHROME + contentTop + contentBottom,
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  useEffect(() => {
    setDraftMove('');
  }, [chessNotation]);

  const stopSharedEngine = useCallback(() => {
    const service = runtime.getService();
    if (service) void service.getEngine().stop();
  }, [runtime]);

  useEffect(() => {
    playClaimRef.current = claimEngineForPlay(stopSharedEngine);
    gradingKeyRef.current = null;
    return () => {
      playClaimRef.current = claimEngineForPlay(stopSharedEngine);
    };
  }, [positionId, stopSharedEngine]);

  useEffect(() => {
    return () => {
      sessionRef.current.setAnalyzer(null);
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
    if (startedRef.current || restoredRef.current || !positionId) return;
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

  const applyRecord = useCallback((record: {
    attemptScore: number | null;
    analysisStatus?: AnalysisStatus;
    gradeConfidence?: GradeConfidence;
  }, summary: { score: number; count: number; estimatedScore: number; estimatedCount: number; attemptCount: number; winCount: number }) => {
    setScoreDelta((prev) => ({
      oldScore: prev?.oldScore ?? summary.score,
      newScore: summary.score,
      count: summary.count,
      estimatedScore: summary.estimatedScore,
      estimatedCount: summary.estimatedCount,
      attemptCount: summary.attemptCount,
      winCount: summary.winCount,
      attemptScore: record.attemptScore,
      analysisStatus: record.analysisStatus ?? 'pending',
      gradeConfidence: record.gradeConfidence ?? null,
    }));
  }, []);

  const gradeStored = useCallback(async (result: TheoreticalAttemptResult) => {
    const key = `${result.positionId}|${result.finishedAt}`;
    if (gradingKeyRef.current === key) return;
    gradingKeyRef.current = key;
    try {
      const service = runtime.getService();
      if (!service) {
        const fromLine = await runPostGameGrade({
          themeId: result.themeId,
          positionId: result.positionId,
          finishedAt: result.finishedAt,
          analyzer: {
            async analyze() {
              return { scoreCp: 0, mateIn: null, depth: 0, wdl: null, bestMove: null };
            },
          },
          trajectoryOnly: true,
        });
        if (fromLine && typeof fromLine.attemptScore === 'number') {
          const summary = await getThemeComprehension(result.themeId);
          applyRecord(fromLine, summary);
          return;
        }
        const failed = await updateAttemptGrade(result.themeId, result.positionId, result.finishedAt, {
          analysisStatus: 'failed',
          gradeCause: 'engine-unavailable',
          attemptScore: null,
          gradeConfidence: null,
        });
        if (failed) {
          const summary = await getThemeComprehension(result.themeId);
          applyRecord(failed, summary);
        }
        return;
      }
      releaseEngineFromPlay(playClaimRef.current);
      const finished = await runPostGameGrade({
        themeId: result.themeId,
        positionId: result.positionId,
        finishedAt: result.finishedAt,
        analyzer: service,
        onProgress: (record) => {
          void getThemeComprehension(result.themeId).then((summary) => applyRecord(record, summary));
        },
      });
      if (!finished) return;
      const summary = await getThemeComprehension(result.themeId);
      applyRecord(finished, summary);
      await resumePendingGrades(service);
    } finally {
      if (gradingKeyRef.current === key) gradingKeyRef.current = null;
    }
  }, [applyRecord, runtime]);

  useEffect(() => {
    const result = snap.result;
    if (!result) return;
    if (result.outcome !== 'success' && result.outcome !== 'theoretical-loss') return;
    let cancelled = false;
    void (async () => {
      if (!recordedRef.current) {
        recordedRef.current = true;
        const delta = await recordAttempt(result);
        if (!cancelled) setScoreDelta(viewFromDelta(delta));
      }
      if (cancelled || !engineReady) return;
      const stored = await getAttempt(result.themeId, result.positionId, result.finishedAt);
      if (!stored || stored.analysisStatus !== 'pending') return;
      await gradeStored(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [snap.result, engineReady, gradeStored]);

  const goHub = useCallback(
    () => router.replace('/puzzles/finales-theoriques' as Href),
    [router],
  );
  const confirmExit = useActiveSessionBack({
    sessionActive:
      snap.phase === 'playing' ||
      snap.phase === 'thinking' ||
      snap.phase === 'verifying',
    kind: 'exercice',
    activityId: sessionId,
    onLeave: goHub,
    onNavigateBack: goHub,
    captureHardwareBack: true,
  });

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
    enabled: true,
    forceOff: !canMove,
    isSpeaking,
    positionFen: snap.fen,
    onSan: submitSan,
  });

  useEffect(() => speechService.onSpeakingChange(setIsSpeaking), []);

  useEffect(() => {
    if (snap.generation !== spokenGeneration.current) {
      spokenGeneration.current = snap.generation;
      spokenThrough.current = snap.moveSans.length;
      speechService.stop();
      return;
    }
    const plan = movesToAnnounce(spokenThrough.current, snap.moveSans, voiceEnabled);
    spokenThrough.current = plan.nextCount;
    for (const san of plan.toSpeak) {
      speechService.speak(sanToVerbal(san), { ownerId: 'theoretical-endgame' });
    }
  }, [snap.generation, snap.moveSans, voiceEnabled]);

  const toggleInputMode = useCallback(() => {
    void setChessInputMode(inputMode === 'classic' ? 'keypad' : 'classic');
  }, [inputMode, setChessInputMode]);

  const commitKeypadMove = useCallback(
    (raw: string) => {
      const played = raw.trim();
      if (!played || !canMove) return;
      setDraftMove('');
      void submitSan(played);
    },
    [canMove],
  );

  const moveRows = useMemo(
    () => pairMoveHistory(snap.moveSans, snap.startFen ?? snap.fen),
    [snap.moveSans, snap.startFen, snap.fen],
  );

  const theme = snap.position ? getTheme(snap.position.themeId) : null;
  const themeTitle = theme ? t(themeTitleKey(theme.titleKey)) : '';
  const objectiveLabel =
    snap.position?.objectiveKind === 'stop-pawn'
      ? t('quiz.theoreticalObjectiveStopPawn')
      : snap.position?.objectiveKind === 'promote-and-win'
        ? t('quiz.theoreticalObjectivePromote')
        : snap.objective === 'WIN'
          ? t('quiz.theoreticalObjectiveWin')
          : t('quiz.theoreticalObjectiveDraw');

  const showResult =
    snap.phase === 'success' ||
    snap.phase === 'theoretical-loss' ||
    snap.phase === 'interrupted';
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
    playClaimRef.current = claimEngineForPlay(stopSharedEngine);
    gradingKeyRef.current = null;
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

  const campLabel =
    snap.playerColor === 'w' ? t('puzzle.youPlayWhite') : t('puzzle.youPlayBlack');

  return (
    <>
      <ChessScreenScaffold
        title={themeTitle}
        subtitle={`${objectiveLabel} · ${campLabel}`}
        onBack={confirmExit}
        testID="theoretical-endgame-play"
      >
        {snap.position && !showResult && (
          <PositionReferenceBadge id={snap.position.id} />
        )}

        {snap.finishGameActive && (
          <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
            {t('review.finishGame')}
          </Text>
        )}

        <Text style={{ color: colors.mutedForeground, fontSize: 13 }} testID="theoretical-move-count">
          {t('quiz.theoreticalMovesPlayed', { count: snap.userMoves })}
        </Text>

        <View style={styles.statusRow} testID="theoretical-status-row">
          <View style={styles.statusGrow}>
            <GameStatusCard
              status={snap.lastFeedback ?? ''}
              heardText=""
              isGameOver={showResult}
              isOpponentThinking={thinking && engineReady}
              thinkingLabel={
                snap.phase === 'verifying'
                  ? t('quiz.theoreticalVerifying')
                  : t('quiz.defendsNulleReflecting')
              }
              composeText={keypadActive ? draftMove : null}
              compact
              testID="theoretical-coup-banner"
            />
          </View>
          <View style={styles.boardToggles}>
            <BoardVisibilityToggle
              visible={boardVisible}
              onToggle={() => setBoardVisible((v) => !v)}
            />
            <BoardCoordinatesToggle
              visible={showCoordinates}
              onToggle={() => {
                void toggleCoordinates();
              }}
            />
          </View>
        </View>

        <ChessBoardSection boardSize={boardSize} testID="theoretical-board">
          {boardVisible ? (
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
          ) : (
            <HiddenBoardPlaceholder
              size={boardSize}
              sizeMode="wide"
              onReveal={() => setBoardVisible(true)}
            />
          )}
        </ChessBoardSection>

        <EndgameEngineStatusBanner
          snapshot={engineSnap}
          onRetry={() => void retryEngine()}
          onBack={confirmExit}
        />

        <ClassicCommandInputChrome
          keypadActive={keypadActive}
          draftMove={draftMove}
          onChangeDraft={setDraftMove}
          onSubmit={commitKeypadMove}
          fen={snap.fen}
          canAct={canMove}
          speech={speech}
          onToggleInput={toggleInputMode}
          keypadTestID="theoretical-move-keypad"
          commandRowTestID="theoretical-command-row"
          micTestID="theoretical-mic"
          toggleTestID="theoretical-input-mode-toggle"
        />

        <GameMoveHistoryCard
          moveRows={moveRows}
          opening={null}
          emptyMessage={t('game.startsHere')}
        />

        {showResult && snap.result && (
          <View style={styles.result}>
            {snap.position && (
              <PositionReferenceBadge id={snap.position.id} />
            )}

            <TheoreticalResultCard
              headline={headlineFor({
                score: scoreDelta ? scoreDelta.attemptScore : snap.result.attemptScore,
                outcome: snap.result.outcome,
                objective: snap.result.objective,
                objectiveKind: snap.result.objectiveKind,
                lang: language === 'en' ? 'en' : 'fr',
              })}
              comment={
                (scoreDelta ? scoreDelta.attemptScore : snap.result.attemptScore) != null &&
                snap.result.quality
                  ? language === 'en'
                    ? snap.result.quality.commentEn
                    : snap.result.quality.commentFr
                  : null
              }
              stats={t('quiz.theoreticalResultStats', {
                moves: snap.result.userMoves,
                time: formatDuration(snap.result.durationMs)[language === 'en' ? 'en' : 'fr'],
              })}
              official={
                snap.result.officialResultMessage ??
                snap.officialResultMessage ??
                snap.lastFeedback
              }
              tone={snap.phase === 'theoretical-loss' ? '#c44' : '#398a55'}
              commentColor={colors.foreground}
              statsColor={colors.mutedForeground}
            />

            {snap.result.firstTheoreticalLoss && snap.phase === 'theoretical-loss' && (
              <Text style={{ color: colors.foreground }}>
                {snap.result.firstTheoreticalLoss.message}
              </Text>
            )}

            <TheoreticalAttemptNote
              score={scoreDelta ? scoreDelta.attemptScore : snap.result.attemptScore}
              pending={
                (scoreDelta?.analysisStatus === 'pending' ||
                  scoreDelta?.analysisStatus === 'running' ||
                  (!scoreDelta && snap.result.analysisStatus === 'pending')) &&
                (scoreDelta ? scoreDelta.attemptScore : snap.result.attemptScore) == null
              }
            />

            {scoreDelta && scoreDelta.attemptCount > 0 && (
              <View style={styles.statsBox}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }} testID="theoretical-attempt-count">
                  {t('quiz.theoreticalAttemptWins', {
                    attempts: scoreDelta.attemptCount,
                    wins: scoreDelta.winCount,
                  })}
                </Text>
              </View>
            )}

            {scoreDelta?.analysisStatus === 'failed' && snap.result.outcome === 'success' && (
              <AppButton
                label={t('quiz.theoreticalRecalculate')}
                onPress={() => {
                  if (!snap.result) return;
                  gradingKeyRef.current = null;
                  void gradeStored(snap.result);
                }}
                variant="secondary"
                testID="theoretical-recalculate"
              />
            )}

            <AppButton
              label={t('quiz.analyseGame')}
              onPress={() => {
                if (!snap.result || busy) return;
                setBusy(true);
                void openTheoreticalInReader({
                  result: snap.result,
                  mode: 'game',
                  routerPush: (href) => router.push(href as Href),
                }).finally(() => setBusy(false));
              }}
              testID="theoretical-analyse-game"
            />
            <AppButton
              label={t('quiz.analysePosition')}
              onPress={() => {
                if (!snap.result || busy) return;
                setBusy(true);
                void openTheoreticalInReader({
                  result: snap.result,
                  mode: 'position',
                  routerPush: (href) => router.push(href as Href),
                }).finally(() => setBusy(false));
              }}
              testID="theoretical-analyse-position"
            />
            <AppButton
              label={t('quiz.theoreticalRetry')}
              onPress={() => void handleRetry()}
              variant="secondary"
              testID="theoretical-retry"
            />

            {showFinishGame && (
              <AppButton
                label={t('review.finishGame')}
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
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusGrow: { flex: 1, minWidth: 0 },
  boardToggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  result: { gap: DesignTokens.spacing.sm },
  statsBox: { gap: 2 },
  missingBox: { gap: DesignTokens.spacing.md, paddingVertical: DesignTokens.spacing.lg },
});
