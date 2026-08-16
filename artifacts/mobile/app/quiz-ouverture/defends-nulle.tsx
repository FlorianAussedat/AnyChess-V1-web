import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { AnyChessDifficultyId } from '@/lib/difficulty/anyChessDifficulty';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import {
  DefendDrawSession,
  DEFEND_DRAW_TARGET_MOVES,
  type DefendDrawSnapshot,
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

  const sessionRef = useRef(
    new DefendDrawSession({
      probeOptions: { tablebaseTimeoutMs: 2000 },
      targetMoves: DEFEND_DRAW_TARGET_MOVES,
    }),
  );
  const [difficulty, setDifficulty] = useState<AnyChessDifficultyId>('debutant');
  const [snap, setSnap] = useState<DefendDrawSnapshot>(() => sessionRef.current.snapshot());
  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);
  const recentRef = useRef<string[]>([]);
  const startedRef = useRef(false);

  const refresh = useCallback((next: DefendDrawSnapshot) => {
    setSnap(next);
    setSelected(null);
    setLegalDests([]);
  }, []);

  const startRound = useCallback(
    async (diff: AnyChessDifficultyId) => {
      setBusy(true);
      try {
        const next = await sessionRef.current.start(diff, recentRef.current);
        if (next.position) {
          recentRef.current = [next.position.id, ...recentRef.current].slice(0, 8);
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
    startedRef.current = true;
    void startRound('debutant');
  }, [startRound]);

  const onDifficultyChange = (next: AnyChessDifficultyId) => {
    setDifficulty(next);
    void startRound(next);
  };

  const playUserMove = useCallback(
    async (from: string, to: string) => {
      if (busy || snap.phase !== 'playing') return;
      setBusy(true);
      try {
        const next = await sessionRef.current.attemptMove(from, to);
        refresh(next);
      } finally {
        setBusy(false);
      }
    },
    [busy, snap.phase, refresh],
  );

  const submitSan = useCallback(
    async (raw: string) => {
      if (busy || snap.phase !== 'playing') return;
      setBusy(true);
      try {
        const next = await sessionRef.current.answerSan(raw);
        refresh(next);
      } finally {
        setBusy(false);
      }
    },
    [busy, snap.phase, refresh],
  );

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    forceOff: busy || snap.phase !== 'playing',
    isSpeaking: false,
    onTranscript: (raw) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      void submitSan(raw);
    },
  });

  const onSquarePress = useCallback(
    (square: string) => {
      if (busy || snap.phase !== 'playing') return;
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
    [busy, snap.phase, selected, legalDests, playUserMove],
  );

  const board = useMemo(() => boardFromFen(snap.fen), [snap.fen]);
  const lastMove = snap.lastMove as LastMove | null;
  const finished =
    snap.phase === 'won' || snap.phase === 'lost' || snap.phase === 'drawn-early';

  const statusColor =
    snap.phase === 'won' || snap.phase === 'drawn-early'
      ? '#398a55'
      : snap.phase === 'lost'
        ? '#c44'
        : colors.foreground;

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

      <Text
        style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}
        testID="defends-nulle-progress"
      >
        {t('quiz.defendsNulleProgress', {
          current: snap.playerMovesMade,
          total: snap.targetMoves,
        })}
      </Text>

      {!!snap.position && (
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          {snap.position.label}
        </Text>
      )}

      <ChessBoardSection
        boardSize={wideBoardSize}
        style={{ gap: 8 }}
        toolbar={
          <BoardToolbar
            label={
              snap.playerColor === 'w' ? t('puzzle.youPlayWhite') : t('puzzle.youPlayBlack')
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

      {(busy || snap.phase === 'thinking') && (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground }}>
            {snap.phase === 'thinking' ? t('quiz.defendsNulleThinking') : t('quiz.defendsNulleLoading')}
          </Text>
        </View>
      )}

      {!!snap.lastFeedback && (
        <Text style={{ color: statusColor, fontFamily: DesignTokens.typography.weightSemiBold }}>
          {snap.lastFeedback}
        </Text>
      )}

      {!finished && snap.phase === 'playing' && !busy && (
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
        </View>
      )}

      {finished && (
        <AppButton
          label={t('quiz.defendsNulleAgain')}
          onPress={() => void startRound(difficulty)}
          testID="defends-nulle-again"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.md,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
