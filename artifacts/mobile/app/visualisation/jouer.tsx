import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BoardToolbar } from '@/components/BoardToolbar';
import { AppButton } from '@/components/ui/AppButton';
import { ChessBoard } from '@/components/ChessBoard';
import type { BoardPiece } from '@/contexts/GameContext';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useBoardTouchSelection } from '@/hooks/useGameScreenInteraction';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { DesignTokens } from '@/constants/designTokens';
import { legalDestinationsForSquare } from '@/lib/game';
import { defaultKeyValueStorage } from '@/lib/storage';
import {
  PlayMoveRecordsStore,
  PlayMoveSession,
  pickPlayMoveChallenge,
  sideToMoveLabel,
  isFlippedForSideToMove,
  type PlayMoveSnapshot,
} from '@/lib/playMove';
import { speechService } from '@/services/SpeechService';
import { audioSettings } from '@/services/AudioSettings';

const records = new PlayMoveRecordsStore(defaultKeyValueStorage);

export default function JouerLeCoupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  useCancelSpeechOnLeave();

  const sessionRef = useRef(new PlayMoveSession({ pickChallenge: pickPlayMoveChallenge }));
  const [snap, setSnap] = useState<PlayMoveSnapshot>(() => sessionRef.current.snapshot());
  const [boardFen, setBoardFen] = useState<string | null>(null);
  const spokenChallengeIdRef = useRef<string | null>(null);

  const sync = useCallback(() => {
    setSnap(sessionRef.current.snapshot());
  }, []);

  useEffect(() => () => sessionRef.current.dispose(), []);

  useEffect(() => {
    records
      .loadBest()
      .then((best) => {
        sessionRef.current.configure({ previousRecord: best });
        sync();
      })
      .catch(() => undefined);
  }, [sync]);

  useEffect(() => {
    if (snap.phase !== 'countdown' && snap.phase !== 'playing') return;
    const id = setInterval(sync, snap.phase === 'countdown' ? 100 : 250);
    return () => clearInterval(id);
  }, [snap.phase, sync]);

  useEffect(() => {
    if (snap.phase === 'playing' && snap.challenge) {
      setBoardFen(snap.challenge.initialFen);
    } else if (snap.phase !== 'playing') {
      setBoardFen(null);
    }
  }, [snap.phase, snap.challenge?.puzzleId, snap.boardResetToken]);

  useEffect(() => {
    if (snap.phase !== 'playing' || !snap.challenge) return;
    if (spokenChallengeIdRef.current === snap.challenge.puzzleId) return;
    spokenChallengeIdRef.current = snap.challenge.puzzleId;
    if (!audioSettings.isVoiceEnabled()) return;
    speechService.speak(snap.challenge.promptVerbal, {
      flush: true,
      ownerId: 'play-move',
      rate: 0.95,
    });
  }, [snap.phase, snap.challenge?.puzzleId, snap.challenge?.promptVerbal]);

  useEffect(() => {
    if (snap.phase !== 'completed') return;
    speechService.cancel('play-move-complete');
    records
      .saveScore(snap.score.score)
      .then(() => sync())
      .catch(() => undefined);
  }, [snap.phase, snap.score.score, sync]);

  const beginSession = useCallback(async () => {
    spokenChallengeIdRef.current = null;
    await audioSettings.ensureLoaded().catch(() => undefined);
    const best = await records.loadBest().catch(() => 0);
    sessionRef.current.configure({ previousRecord: best });
    sessionRef.current.startCountdown();
    sync();
  }, [sync]);

  const game = useMemo(() => (boardFen ? new Chess(boardFen) : null), [boardFen]);
  const sideToMove = game?.turn() ?? 'w';
  const turnLabel = sideToMoveLabel(sideToMove);
  const boardFlipped = isFlippedForSideToMove(sideToMove);

  const { touchSelected, legalDests, onSquarePress } = useBoardTouchSelection({
    canAct: snap.phase === 'playing' && !!snap.challenge,
    getLegalDestinations: (square) => {
      if (!game || !snap.challenge) return [];
      return legalDestinationsForSquare(game, square, sideToMove, { waitingForUser: true });
    },
    movePieceBySquare: (from, to) => {
      if (!snap.challenge) return false;
      sessionRef.current.attemptBoardMove(from, to, snap.challenge.setupMove.promotion ?? null);
      sync();
      return true;
    },
  });

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
      testID="jouer-screen"
    >
      <ScreenHeader
        onBack={() => {
          speechService.cancel('play-move-leave');
          sessionRef.current.returnToIdle();
          sync();
          router.back();
        }}
        title="Jouer le coup"
        showSound
      />

      {snap.phase === 'idle' && (
        <View style={styles.gap}>
          <Text style={{ color: colors.mutedForeground }}>
            Joue le coup demandé sur l’échiquier, le plus rapidement possible, pendant 60 secondes.
          </Text>
          <Text style={{ color: colors.foreground }}>Record actuel : {snap.previousRecord}</Text>
          <AppButton label="Commencer" onPress={() => void beginSession()} testID="jouer-start" />
          <AppButton
            label="Voir les records"
            variant="secondary"
            onPress={() => router.push('/visualisation/records')}
          />
        </View>
      )}

      {snap.phase === 'countdown' && (
        <View style={styles.countdownWrap} testID="jouer-countdown">
          <Text style={[styles.countdown, { color: colors.foreground }]}>
            {snap.countdownLabel}
          </Text>
        </View>
      )}

      {snap.phase === 'playing' && game && snap.challenge && (
        <View style={styles.gap}>
          <View style={styles.hudRow}>
            <Text style={[styles.hudValue, { color: colors.foreground }]} testID="jouer-timer">
              {snap.remainingSeconds}s
            </Text>
            <Text style={[styles.hudValue, { color: colors.foreground }]} testID="jouer-score">
              Score : {snap.score.score}
            </Text>
          </View>
          <Text style={[styles.prompt, { color: colors.primary }]} testID="jouer-prompt">
            {snap.challenge.promptVerbal}
          </Text>
          {snap.lastFeedback === 'wrong' ? (
            <Text style={{ color: '#BE3030' }} testID="jouer-wrong">
              Incorrect — réessaie
            </Text>
          ) : null}
          <BoardToolbar
            label={turnLabel}
            showCoordinates={showCoordinates}
            onToggleCoordinates={() => {
              void toggleCoordinates();
            }}
          />
          <ChessBoard
            board={game.board() as (BoardPiece | null)[][]}
            lastMove={null}
            selectedSquare={touchSelected}
            legalDots={legalDests}
            onSquarePress={onSquarePress}
            showCoordinates={showCoordinates}
            isFlipped={boardFlipped}
          />
        </View>
      )}

      {snap.phase === 'completed' && (
        <View style={styles.gap} testID="jouer-results">
          <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>SCORE</Text>
          <Text style={[styles.scoreValue, { color: colors.foreground }]}>{snap.score.score}</Text>
          {snap.isNewRecord ? (
            <Text style={[styles.newRecord, { color: colors.primary }]} testID="jouer-new-record">
              Nouveau record !
            </Text>
          ) : null}
          <Text style={{ color: colors.foreground }}>
            Coups correctement joués : {snap.score.correct}
          </Text>
          <Text style={{ color: colors.foreground }}>Incorrect : {snap.score.wrong}</Text>
          <Text style={{ color: colors.mutedForeground }}>
            Record : {Math.max(snap.previousRecord, snap.score.score)}
          </Text>
          <AppButton
            label="Retour"
            onPress={() => {
              sessionRef.current.returnToIdle();
              sync();
              router.back();
            }}
          />
          <AppButton
            label="Voir les records"
            variant="secondary"
            onPress={() => router.push('/visualisation/records')}
          />
          <AppButton
            label="Rejouer"
            variant="secondary"
            onPress={() => {
              sessionRef.current.replay();
              void beginSession();
            }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.lg,
  },
  gap: { gap: DesignTokens.spacing.md },
  countdownWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  countdown: { fontSize: 96, fontFamily: DesignTokens.typography.weightBold },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudValue: { fontSize: 22, fontFamily: DesignTokens.typography.weightBold },
  prompt: {
    fontSize: 28,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  scoreValue: {
    fontSize: 64,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
  },
  newRecord: {
    fontSize: 20,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
  },
});
