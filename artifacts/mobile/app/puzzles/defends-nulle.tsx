import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { GameMicButton } from '@/components/game/GameMicButton';
import { BoardToolbar } from '@/components/BoardToolbar';
import { DifficultySelector } from '@/components/difficulty/DifficultySelector';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { copyToClipboard } from '@/lib/clipboard';
import type { AnyChessDifficultyId } from '@/lib/difficulty/anyChessDifficulty';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import type { EngineStatus } from '@/lib/engines';
import {
  DefendDrawSession,
  DEFEND_DRAW_ENGINE_CONFIG,
  StockfishAnalysisService,
  toggleFavorite,
  isFavorite,
  type EndgameSnapshot,
  type FirstErrorResult,
} from '@/lib/defendDraw';

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export default function DefendsNulleScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const wideBoardSize = useBoardSize('wide');
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();

  const analyzerRef = useRef<StockfishAnalysisService | null>(null);
  const sessionRef = useRef(new DefendDrawSession({}));
  const [difficulty, setDifficulty] = useState<AnyChessDifficultyId>('debutant');
  const [snap, setSnap] = useState<EndgameSnapshot>(() =>
    sessionRef.current.snapshot(),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('uninitialized');
  const [engineError, setEngineError] = useState<string | null>(null);
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);
  const [fenCopied, setFenCopied] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [firstError, setFirstError] = useState<FirstErrorResult | null>(null);
  const recentRef = useRef<string[]>([]);
  const startedRef = useRef(false);

  useEffect(() => {
    const service = new StockfishAnalysisService({
      moveTimeMs: DEFEND_DRAW_ENGINE_CONFIG.moveTimeMs,
      analysisTimeoutMs: DEFEND_DRAW_ENGINE_CONFIG.analysisTimeoutMs,
      bootTimeoutMs: DEFEND_DRAW_ENGINE_CONFIG.bootTimeoutMs,
    });
    analyzerRef.current = service;
    sessionRef.current.setAnalyzer(service);
    let cancelled = false;

    const unsub = service.onStatusChange((status) => {
      if (!cancelled) setEngineStatus(status);
    });
    setEngineStatus(service.getStatus());

    void service
      .init()
      .then(() => {
        if (cancelled) return;
        setEngineStatus(service.getStatus());
        setEngineError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setEngineStatus(service.getStatus());
        setEngineError(t('quiz.defendsNulleEngineUnavailable'));
      });

    return () => {
      cancelled = true;
      unsub();
      sessionRef.current.setAnalyzer(null);
      service.destroy();
      analyzerRef.current = null;
    };
  }, [t]);

  const engineReady = engineStatus === 'ready' || engineStatus === 'thinking';
  const enginePreparing =
    engineStatus === 'loading' || engineStatus === 'uninitialized';

  const refresh = useCallback((next: EndgameSnapshot) => {
    setSnap(next);
    setSelected(null);
    setLegalDests([]);
    setFirstError(null);
    setFenCopied(false);
  }, []);

  const startRound = useCallback(
    async (diff: AnyChessDifficultyId) => {
      setBusy(true);
      try {
        const next = await sessionRef.current.start(diff, recentRef.current);
        if (next.position) {
          recentRef.current = [next.position.id, ...recentRef.current].slice(0, 12);
          isFavorite(next.position.id).then(setIsFav).catch(() => setIsFav(false));
        }
        refresh(next);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (startedRef.current) return;
    if (!engineReady) return;
    startedRef.current = true;
    void startRound('debutant');
  }, [engineReady, startRound]);

  const onDifficultyChange = (next: AnyChessDifficultyId) => {
    setDifficulty(next);
    if (engineReady) void startRound(next);
  };

  const nextPosition = useCallback(() => {
    void startRound(difficulty);
  }, [difficulty, startRound]);

  const restartSame = useCallback(async () => {
    setBusy(true);
    try {
      refresh(await sessionRef.current.restart());
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleOfferDraw = useCallback(async () => {
    if (busy || !engineReady) return;
    setBusy(true);
    try {
      refresh(await sessionRef.current.offerDraw());
    } finally {
      setBusy(false);
    }
  }, [busy, engineReady, refresh]);

  const handleCopyFen = useCallback(async () => {
    if (!snap.startFen) return;
    const ok = await copyToClipboard(snap.startFen);
    if (ok) {
      setFenCopied(true);
      setTimeout(() => setFenCopied(false), 2000);
    }
  }, [snap.startFen]);

  const handleToggleFavorite = useCallback(async () => {
    if (!snap.position) return;
    const nowFav = await toggleFavorite(snap.position.id);
    setIsFav(nowFav);
  }, [snap.position]);

  const handleAnalyzeError = useCallback(async () => {
    if (snap.phase !== 'failure') return;
    setBusy(true);
    try {
      const result = await sessionRef.current.analyzeFirstError();
      setFirstError(result);
    } finally {
      setBusy(false);
    }
  }, [snap.phase]);

  // Auto-analyze on failure
  useEffect(() => {
    if (snap.phase === 'failure' && !firstError) {
      void handleAnalyzeError();
    }
  }, [snap.phase, firstError, handleAnalyzeError]);

  const playUserMove = useCallback(
    async (from: string, to: string) => {
      if (busy || !engineReady) return;
      if (snap.phase !== 'playing') return;
      setBusy(true);
      try {
        refresh(await sessionRef.current.attemptMove(from, to));
      } finally {
        setBusy(false);
      }
    },
    [busy, engineReady, snap.phase, refresh],
  );

  const submitSan = useCallback(
    async (raw: string) => {
      if (busy || !engineReady) return;
      if (snap.phase !== 'playing') return;
      setBusy(true);
      try {
        refresh(await sessionRef.current.answerSan(raw));
      } finally {
        setBusy(false);
      }
    },
    [busy, engineReady, snap.phase, refresh],
  );

  const thinking =
    busy || snap.phase === 'thinking' || engineStatus === 'thinking';

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    forceOff: thinking || !engineReady || snap.phase !== 'playing',
    isSpeaking: false,
    onTranscript: (raw) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      void submitSan(raw);
    },
  });

  const onSquarePress = useCallback(
    (square: string) => {
      if (thinking || !engineReady) return;
      if (snap.phase !== 'playing') return;
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
    },
    [thinking, engineReady, snap.phase, selected, legalDests, playUserMove],
  );

  const board = useMemo(() => boardFromFen(snap.fen), [snap.fen]);
  const lastMove = snap.lastMove as LastMove | null;
  const challengeEnded = snap.phase === 'success' || snap.phase === 'failure';
  const canMove = engineReady && !thinking && snap.phase === 'playing';

  const statusColor =
    snap.phase === 'success'
      ? '#398a55'
      : snap.phase === 'failure'
        ? '#c44'
        : colors.foreground;

  const objectiveColor = snap.objective === 'WIN' ? '#e8a735' : '#4a9eff';

  const busyLabel = enginePreparing
    ? t('quiz.defendsNullePreparing')
    : snap.phase === 'thinking' || engineStatus === 'thinking'
      ? t('quiz.defendsNulleReflecting')
      : t('quiz.defendsNulleLoading');

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
      testID="defends-nulle-screen"
    >
      <ScreenHeader onBack={() => router.back()} title={t('quiz.defendsNulle')} showSound />

      <Text style={{ color: colors.mutedForeground }}>{t('quiz.defendsNulleLead')}</Text>

      <DifficultySelector
        value={difficulty}
        onChange={onDifficultyChange}
        testID="defends-nulle-difficulty"
      />

      {!!snap.position && (
        <View style={styles.objectiveRow}>
          <Text
            style={{
              color: objectiveColor,
              fontFamily: DesignTokens.typography.weightSemiBold,
              fontSize: 15,
            }}
            testID="defends-nulle-objective"
          >
            {snap.objective === 'WIN'
              ? t('quiz.endgameObjectiveWin')
              : t('quiz.endgameObjectiveDraw')}
          </Text>
          <Pressable onPress={handleToggleFavorite} hitSlop={8}>
            <Text style={{ fontSize: 20 }}>{isFav ? '★' : '☆'}</Text>
          </Pressable>
        </View>
      )}

      <Text
        style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}
        testID="defends-nulle-progress"
      >
        {t('quiz.defendsNulleProgress', { current: snap.playerMovesMade })}
      </Text>

      {!!snap.position && (
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          {snap.position.label}
        </Text>
      )}

      {!!snap.poolError && (
        <Text style={{ color: '#c44' }} testID="defends-nulle-pool-error">
          {snap.poolError}
        </Text>
      )}

      <ChessBoardSection
        boardSize={wideBoardSize}
        style={{ gap: 8 }}
        toolbar={
          <BoardToolbar
            label={
              snap.playerColor === 'w'
                ? t('puzzle.youPlayWhite')
                : t('puzzle.youPlayBlack')
            }
            showCoordinates={showCoordinates}
            onToggleCoordinates={() => {
              void toggleCoordinates();
            }}
          />
        }
        testID="defends-nulle-board"
      >
        <ChessBoard
          board={board}
          lastMove={lastMove}
          isFlipped={snap.playerColor === 'b'}
          selectedSquare={selected}
          legalDots={legalDests}
          onSquarePress={onSquarePress}
          showCoordinates={showCoordinates}
          sizeMode="wide"
          size={wideBoardSize}
        />
      </ChessBoardSection>

      {!!engineError && !enginePreparing && (
        <Text style={{ color: '#c44' }} testID="defends-nulle-engine-error">
          {engineError}
        </Text>
      )}

      {(enginePreparing || thinking) && !engineError && (
        <View style={styles.busyRow} testID="defends-nulle-engine-busy">
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground }}>{busyLabel}</Text>
        </View>
      )}

      {!!snap.lastFeedback && (
        <Text
          style={{
            color: statusColor,
            fontFamily: DesignTokens.typography.weightSemiBold,
          }}
          testID="defends-nulle-feedback"
        >
          {snap.lastFeedback}
        </Text>
      )}

      {canMove && (
        <View style={{ gap: DesignTokens.spacing.md }}>
          <ChessMoveInput
            inputType="chess-move"
            fen={snap.fen}
            onSubmit={(raw) => {
              void submitSan(raw);
            }}
            enabled
            autoSubmit
            testID="defends-nulle-move-input"
          />
          <GameMicButton
            showRecognized={showRecognizedFlash}
            isListening={isListening}
            micActive={micActive}
            micMessage={micStatus.message}
            onToggle={toggleMic}
            testID="defends-nulle-mic"
          />
          {snap.canOfferDraw && (
            <AppButton
              label={t('quiz.endgameOfferDraw')}
              onPress={() => void handleOfferDraw()}
              testID="defends-nulle-offer-draw"
            />
          )}
        </View>
      )}

      {challengeEnded && (
        <View style={styles.endActions} testID="defends-nulle-end-actions">
          {firstError?.found && (
            <View style={[styles.errorBox, { borderColor: '#c44' }]}>
              <Text style={{ color: '#c44', fontFamily: DesignTokens.typography.weightSemiBold }}>
                {firstError.message}
              </Text>
              <Text style={{ color: colors.foreground }}>
                {`Coup joué : ${firstError.moveSan}`}
              </Text>
              {firstError.bestMoveSan && (
                <Text style={{ color: colors.foreground }}>
                  {`Meilleur coup : ${firstError.bestMoveSan}`}
                </Text>
              )}
            </View>
          )}
          {snap.phase === 'failure' && firstError && !firstError.found && (
            <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
              {firstError.message}
            </Text>
          )}
          <AppButton
            label={t('quiz.endgameReplay')}
            onPress={() => void restartSame()}
            testID="defends-nulle-restart"
          />
          <AppButton
            label={t('quiz.defendsNulleNext')}
            onPress={nextPosition}
            testID="defends-nulle-another"
          />
          <AppButton
            label={fenCopied ? t('quiz.endgameFenCopied') : t('quiz.endgameCopyFen')}
            onPress={() => void handleCopyFen()}
            testID="defends-nulle-copy-fen"
          />
        </View>
      )}

      <Pressable
        onPress={nextPosition}
        disabled={busy || enginePreparing}
        style={({ pressed }) => [
          styles.nextLink,
          { opacity: busy || enginePreparing ? 0.4 : pressed ? 0.7 : 1 },
        ]}
        testID="defends-nulle-next"
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
          {t('quiz.defendsNulleNext')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.md,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endActions: {
    gap: DesignTokens.spacing.sm,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  nextLink: {
    alignSelf: 'center',
    paddingVertical: DesignTokens.spacing.md,
    marginTop: DesignTokens.spacing.sm,
  },
});
