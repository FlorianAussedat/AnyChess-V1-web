/**
 * Play / result screen for Entraînement aux Finales — shared Classic UI + overlays.
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
import { Chess } from 'chess.js';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessBoard } from '@/components/ChessBoard';
import { ClassicCommandInputChrome } from '@/components/game/ClassicCommandInputChrome';
import { GameMoveHistoryCard } from '@/components/game/GameMoveHistoryCard';
import { GameStatusCard } from '@/components/game/GameStatusCard';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { AppButton } from '@/components/ui/AppButton';
import { PositionReferenceBadge } from '@/components/exercise/PositionReferenceBadge';
import { DefendDrawStarButton } from '@/components/exercise/DefendDrawStarButton';
import { DefendDrawReviewCard } from '@/components/exercise/DefendDrawReviewCard';
import {
  ExerciseResultOverlayHost,
  type ResultOverlayKind,
} from '@/components/review/ExerciseResultOverlayHost';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
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
import { pairMoveHistory } from '@/lib/game';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { usePersistedActivity } from '@/hooks/usePersistedActivity';
import { useActiveSessionBack } from '@/hooks/useActiveSessionBack';
import { getActivitySession } from '@/lib/activitySessions';
import { presentAppDialog } from '@/lib/ui/appDialogStore';
import {
  EndgameEngineStatusBanner,
  useSharedStockfishRuntime,
} from '@/lib/engines/runtime';
import {
  EndgameTrainingSession,
  getPositionById,
  recordFinishedAttempt,
  openEndgameInReader,
  getFinishedIds,
  listDefendDrawFavorites,
  isDefendDrawStarred,
  starDefendDrawPosition,
  unstarDefendDrawPosition,
  getDefendDrawHistoryAttempt,
  attemptFromHistory,
  pickNewPositionAvoiding,
  type SessionSnapshot,
  type EndgameTrainingPosition,
} from '@/lib/endgameTraining';
import { canOfferFinishGame } from '@/lib/endgameTraining/domain/officialResultMessages';
import type {
  FinishGamePayload,
  ReviewLaunchPayload,
} from '@/lib/review/ReviewSessionRegistry';

const CLASSIC_BOARD_RESERVED_CHROME = 340;

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

function syntheticPosition(
  positionId: string,
  fen: string,
  defender: 'white' | 'black',
): EndgameTrainingPosition {
  return {
    id: positionId,
    fen,
    defender,
    objective: 'DRAW',
    source: { provider: 'history', license: '' },
    family: 'mixed',
    materialSignature: '',
    tags: [],
    quality: { initialEvaluation: 0, validationKind: 'stockfish' },
  };
}

export default function EndgameTrainingPlayScreen() {
  const { positionId, source, sessionId: resumeParam, reviewAttempt } = useLocalSearchParams<{
    positionId: string;
    source?: string;
    sessionId?: string;
    reviewAttempt?: string;
  }>();
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const router = useRouter();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { inputMode, setChessInputMode, keypadActive } = useChessInputMode();

  const sessionRef = useRef(new EndgameTrainingSession({}));
  const [snap, setSnap] = useState<SessionSnapshot>(() => sessionRef.current.snapshot());
  const [draftMove, setDraftMove] = useState('');
  const [busy, setBusy] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [starred, setStarred] = useState(false);
  const [overlay, setOverlay] = useState<ResultOverlayKind>(null);
  const bootTokenRef = useRef('');
  const recordedRef = useRef(false);

  const { sessionId } = usePersistedActivity({
    kind: 'defends-nulle',
    modeId: 'puzzles',
    resumeSessionId: typeof resumeParam === 'string' ? resumeParam : undefined,
    title: t('quiz.defendsNulle'),
    summary: snap.position?.id ?? String(positionId ?? ''),
    routeFor: (id) =>
      `/puzzles/defends-nulle-play?positionId=${encodeURIComponent(String(positionId ?? ''))}&source=${source ?? 'new'}&sessionId=${encodeURIComponent(id)}`,
    enabled:
      positionReady &&
      (snap.phase === 'playing' ||
        snap.phase === 'thinking' ||
        snap.phase === 'verifying-loss'),
    revision: `${snap.phase}|${snap.fen}|${snap.movesResisted}|${snap.attemptId}`,
    capture: () => sessionRef.current.snapshot(),
    apply: (payload) => {
      if (!payload?.position || !payload.fen) return;
      if (String(payload.position.id) !== String(positionId ?? '')) return;
      if (typeof reviewAttempt === 'string' && reviewAttempt) return;
      sessionRef.current.restore(payload);
      bootTokenRef.current = `${positionId}|${reviewAttempt ?? ''}|${resumeParam ?? ''}`;
      recordedRef.current = false;
      setSnap(sessionRef.current.snapshot());
      setPositionReady(true);
      setPositionMissing(false);
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

  const refresh = useCallback((next: SessionSnapshot) => {
    setSnap(next);
  }, []);

  useEffect(() => {
    const token = `${positionId ?? ''}|${reviewAttempt ?? ''}|${resumeParam ?? ''}`;
    if (bootTokenRef.current === token) return;
    setPositionReady(false);
    setPositionMissing(false);
    setOverlay(null);
    recordedRef.current = false;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        if (typeof reviewAttempt === 'string' && reviewAttempt) {
          const row = await getDefendDrawHistoryAttempt(reviewAttempt);
          if (cancelled) return;
          if (!row) {
            setPositionMissing(true);
            return;
          }
          const catalog = getPositionById(row.positionId);
          const position = catalog
            ? { ...catalog, fen: row.initialFen, defender: row.playerColor }
            : syntheticPosition(row.positionId, row.initialFen, row.playerColor);
          recordedRef.current = true;
          refresh(sessionRef.current.presentStoredReview(position, attemptFromHistory(row)));
          bootTokenRef.current = token;
          setPositionReady(true);
          return;
        }
        if (!positionId) return;
        if (typeof resumeParam === 'string' && resumeParam) {
          const saved = getActivitySession(resumeParam)?.payload as SessionSnapshot | undefined;
          if (
            saved?.position &&
            saved.fen &&
            String(saved.position.id) === String(positionId)
          ) {
            if (cancelled) return;
            refresh(sessionRef.current.restore(saved));
            bootTokenRef.current = token;
            setPositionReady(true);
            return;
          }
        }
        const pos = getPositionById(String(positionId));
        if (!pos) {
          if (!cancelled) setPositionMissing(true);
          return;
        }
        let next = pos;
        if (source === 'favorite') {
          const favorites = await listDefendDrawFavorites();
          const favorite = favorites.find((item) => item.positionId === pos.id);
          if (favorite) {
            next = { ...pos, fen: favorite.initialFen, defender: favorite.playerColor };
          }
        }
        if (cancelled) return;
        refresh(await sessionRef.current.start(next));
        bootTokenRef.current = token;
        setPositionReady(true);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [positionId, refresh, resumeParam, reviewAttempt, source]);

  useEffect(() => {
    const fen = snap.startFen ?? snap.position?.fen;
    const id = snap.position?.id;
    const color = snap.position?.defender;
    if (!fen || !id || !color) return;
    void isDefendDrawStarred(id, color, fen).then(setStarred);
  }, [snap.startFen, snap.position?.id, snap.position?.defender]);

  useEffect(() => {
    if (!snap.result || recordedRef.current) return;
    if (
      snap.result.outcome !== 'loss' &&
      snap.result.outcome !== 'win-30-moves' &&
      snap.result.outcome !== 'win-official-draw' &&
      snap.result.outcome !== 'abandoned'
    ) {
      return;
    }
    recordedRef.current = true;
    void recordFinishedAttempt(snap.result, {
      family: snap.position?.family,
      materialSignature: snap.position?.materialSignature,
    });
  }, [snap.result, snap.position]);

  const showResult =
    snap.phase === 'lost' ||
    snap.phase === 'won-30' ||
    snap.phase === 'won-draw' ||
    snap.phase === 'abandoned';

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
    enabled: true,
    forceOff: !canMove,
    onSan: submitSan,
  });

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

  const initialFen = snap.startFen ?? snap.position?.fen ?? '';

  const toggleStar = () => {
    if (!snap.position || !initialFen) return;
    const input = {
      positionId: snap.position.id,
      playerColor: snap.position.defender,
      initialFen,
    };
    if (starred) {
      presentAppDialog({
        title: t('quiz.ddUnstarTitle'),
        message: '',
        cancelLabel: t('common.cancel'),
        confirmLabel: t('quiz.ddUnstarConfirm'),
        variant: 'destructive',
        onConfirm: () => {
          void unstarDefendDrawPosition(input).then(() => setStarred(false));
        },
      });
      return;
    }
    void starDefendDrawPosition(input).then(() => setStarred(true));
  };

  const handleRetry = async () => {
    recordedRef.current = false;
    setOverlay(null);
    setBusy(true);
    try {
      refresh(await sessionRef.current.retry());
    } finally {
      setBusy(false);
    }
  };

  const handleNextPosition = async () => {
    if (!snap.position) return;
    const avoidId = snap.position.id;
    const finished = await getFinishedIds();
    const next = pickNewPositionAvoiding(new Set(finished), avoidId);
    if (!next) {
      router.replace('/puzzles/defends-nulle' as Href);
      return;
    }
    router.replace(
      `/puzzles/defends-nulle-play?positionId=${encodeURIComponent(next.id)}&source=new` as Href,
    );
  };

  const leaveToHub = useCallback(
    () => router.replace('/puzzles/defends-nulle' as Href),
    [router],
  );
  const abandonAndLeave = useCallback(() => {
    const next = sessionRef.current.abandon();
    if (next.result?.outcome === 'abandoned' && !recordedRef.current) {
      recordedRef.current = true;
      void recordFinishedAttempt(next.result, {
        family: next.position?.family,
        materialSignature: next.position?.materialSignature,
      });
    }
    leaveToHub();
  }, [leaveToHub]);
  const onPlayBack = useActiveSessionBack({
    sessionActive:
      snap.phase === 'playing' ||
      snap.phase === 'thinking' ||
      snap.phase === 'verifying-loss',
    kind: 'exercice',
    activityId: sessionId,
    onLeave: abandonAndLeave,
    onNavigateBack: leaveToHub,
    captureHardwareBack: true,
  });

  if (positionMissing) {
    return (
      <ChessScreenScaffold
        title={t('quiz.defendsNullePageTitle')}
        onBack={onPlayBack}
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
        onBack={onPlayBack}
        testID="endgame-training-play"
      >
        <View style={styles.busyRow} testID="endgame-position-loading">
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground }}>{t('quiz.defendsNulleLoading')}</Text>
        </View>
      </ChessScreenScaffold>
    );
  }

  const campLabel =
    snap.defender === 'w' ? t('quiz.ddDefendWithWhite') : t('quiz.ddDefendWithBlack');

  return (
    <>
      <ChessScreenScaffold
        title={t('quiz.defendsNullePageTitle')}
        onBack={onPlayBack}
        testID="endgame-training-play"
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
              color: colors.foreground,
              fontFamily: DesignTokens.typography.weightBold,
              fontSize: 20,
              lineHeight: 26,
              flex: 1,
            }}
            testID="endgame-camp-banner"
          >
            {campLabel}
          </Text>
          <DefendDrawStarButton starred={starred} onPress={toggleStar} />
        </View>

        {snap.finishGameActive && (
          <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
            {t('review.finishGame')}
          </Text>
        )}

        <View style={styles.statusRow} testID="endgame-status-row">
          <View style={styles.statusGrow}>
            <GameStatusCard
              status={snap.lastFeedback ?? ''}
              heardText=""
              isGameOver={showResult}
              isOpponentThinking={thinking && engineReady}
              thinkingLabel={
                snap.phase === 'verifying-loss'
                  ? t('quiz.endgameVerifying')
                  : t('quiz.defendsNulleReflecting')
              }
              composeText={keypadActive ? draftMove : null}
              compact
              testID="endgame-coup-banner"
            />
          </View>
          <View style={styles.boardToggles}>
            <BoardCoordinatesToggle
              visible={showCoordinates}
              onToggle={() => {
                void toggleCoordinates();
              }}
            />
          </View>
        </View>

        <ChessBoardSection boardSize={boardSize} testID="endgame-board">
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
          onBack={onPlayBack}
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
          keypadTestID="endgame-move-keypad"
          commandRowTestID="endgame-command-row"
          micTestID="endgame-mic"
          toggleTestID="endgame-input-mode-toggle"
        />

        <GameMoveHistoryCard
          moveRows={moveRows}
          opening={null}
          emptyMessage={t('game.startsHere')}
        />

        {showResult && snap.result && snap.position && (
          <View style={styles.result}>
            <DefendDrawReviewCard
              result={snap.result}
              defender={snap.position.defender}
              notation={chessNotation}
            />

            <AppButton
              label={t('quiz.analyseGame')}
              onPress={() => {
                if (!snap.result || !snap.position || busy) return;
                setBusy(true);
                void openEndgameInReader({
                  result: snap.result,
                  defender: snap.position.defender,
                  mode: 'game',
                  routerPush: (href) => router.push(href as Href),
                }).finally(() => setBusy(false));
              }}
              testID="endgame-analyse-game"
            />

            <AppButton
              label={t('quiz.endgameRetry')}
              onPress={() => void handleRetry()}
              testID="endgame-retry"
            />

            {showFinishGame && (
              <AppButton
                label={t('review.finishGame')}
                onPress={() => setOverlay('finish-game')}
                variant="secondary"
                testID="endgame-finish-game"
              />
            )}

            <AppButton
              label={t('quiz.defendsNulleDefendNext')}
              onPress={() => void handleNextPosition()}
              testID="endgame-next-position"
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  missingBox: { gap: DesignTokens.spacing.md, paddingVertical: DesignTokens.spacing.lg },
});
