/**
 * Play / result — Finales théoriques
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  TheoreticalEndgameSession,
  getPositionById,
  getTheme,
  recordAttempt,
  getThemeComprehension,
  pickPositionInTheme,
  getLastPositionId,
  formatComprehensionScore,
  openTheoreticalInReader,
  type SessionSnapshot,
} from '@/lib/theoreticalEndgame';

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

import type { MessageKey } from '@/lib/i18n';

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

  const sessionRef = useRef(new TheoreticalEndgameSession());
  const [snap, setSnap] = useState<SessionSnapshot>(() => sessionRef.current.snapshot());
  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [scoreDelta, setScoreDelta] = useState<{ old: number; new: number; count: number } | null>(
    null,
  );
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
    return fitBoardSizeToViewport(wide, windowHeight, 300);
  }, [windowWidth, windowHeight]);

  useEffect(() => {
    return () => {
      sessionRef.current.setAnalyzer(null);
      const cur = sessionRef.current.snapshot();
      if (cur.phase === 'playing' || cur.phase === 'thinking' || cur.phase === 'verifying') {
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
      } finally {
        setBusy(false);
      }
    })();
  }, [positionId, refresh]);

  useEffect(() => {
    if (!snap.result || recordedRef.current) return;
    if (snap.result.outcome !== 'success' && snap.result.outcome !== 'theoretical-loss') return;
    recordedRef.current = true;
    void recordAttempt(snap.result).then((d) => setScoreDelta({ old: d.oldScore, new: d.newScore, count: d.count }));
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

  const theme = snap.position ? getTheme(snap.position.themeId) : null;
  const themeTitle = theme ? t(themeTitleKey(theme.titleKey)) : '';
  const objectiveLabel =
    snap.objective === 'WIN'
      ? t('quiz.theoreticalObjectiveWin')
      : t('quiz.theoreticalObjectiveDraw');

  const thinking =
    busy || snap.phase === 'thinking' || snap.phase === 'verifying' || engineSnap.status === 'thinking';
  const canMove =
    engineReady && !thinking && (snap.phase === 'playing' || snap.phase === 'off-score');
  const showResult = snap.phase === 'success' || snap.phase === 'theoretical-loss';
  const board = useMemo(() => boardFromFen(snap.fen), [snap.fen]);

  const handleRetry = async () => {
    recordedRef.current = false;
    setScoreDelta(null);
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
    const last = await getLastPositionId(tid);
    const next = pickPositionInTheme(tid, last);
    if (!next) return;
    recordedRef.current = false;
    setScoreDelta(null);
    startedRef.current = false;
    router.replace(
      `/puzzles/finales-theoriques-play?positionId=${encodeURIComponent(next.id)}&themeId=${encodeURIComponent(tid)}` as Href,
    );
  };

  const handleAnalyse = async () => {
    if (!snap.result) return;
    await openTheoreticalInReader({
      result: snap.result,
      routerPush: (href) => router.push(href as Href),
    });
  };

  const handleContinueOffScore = () => {
    refresh(sessionRef.current.continueOffScore());
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
    <ChessScreenScaffold
      title={themeTitle}
      subtitle={objectiveLabel}
      onBack={confirmExit}
      testID="theoretical-endgame-play"
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {snap.offScore && (
          <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
            {t('quiz.theoreticalOffScore')}
          </Text>
        )}

        <Text style={{ color: colors.mutedForeground, fontSize: 13 }} testID="theoretical-move-count">
          {t('quiz.theoreticalMovesPlayed', { count: snap.userMoves, target: snap.targetUserMoves })}
        </Text>

        <ChessBoardSection boardSize={boardSize} style={{ alignSelf: 'center' }}>
          <BoardToolbar
            label={
              snap.playerColor === 'w'
                ? t('puzzle.youPlayWhite')
                : t('puzzle.youPlayBlack')
            }
            showCoordinates={showCoordinates}
            onToggleCoordinates={() => void toggleCoordinates()}
          />
          <ChessBoard
            board={board}
            lastMove={snap.lastMove as LastMove | null}
            isFlipped={snap.playerColor === 'b'}
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

        {!!snap.lastFeedback && (
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
            testID="theoretical-move-input"
          />
        )}

        {showResult && snap.result && (
          <View style={styles.result} testID="theoretical-result">
            {snap.result.firstTheoreticalLoss && (
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

            <AppButton label={t('quiz.theoreticalAnalyse')} onPress={() => void handleAnalyse()} />
            <AppButton label={t('quiz.theoreticalRetry')} onPress={() => void handleRetry()} variant="secondary" />
            <AppButton label={t('quiz.theoreticalNext')} onPress={() => void handleNext()} variant="secondary" />
    {(snap.phase === 'theoretical-loss') && !snap.offScore && (
              <AppButton
                label={t('quiz.theoreticalContinueOffScore')}
                onPress={handleContinueOffScore}
                variant="secondary"
              />
            )}
            <AppButton
              label={t('quiz.theoreticalBackThemes')}
              onPress={() => router.replace('/puzzles/finales-theoriques' as Href)}
              variant="secondary"
            />
          </View>
        )}
      </ScrollView>
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: DesignTokens.spacing.md, paddingBottom: DesignTokens.spacing.xl },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  result: { gap: DesignTokens.spacing.sm },
  statsBox: { gap: 2 },
  missingBox: { gap: DesignTokens.spacing.md, paddingVertical: DesignTokens.spacing.lg },
});
