import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChessBoard } from '@/components/ChessBoard';
import {
  TimedVisionHud,
  TimedVisionResults,
  TimedVisionSideToMove,
  TimedVisionStart,
  timedVisionStyles,
} from '@/components/visualisation/TimedVisionChrome';
import type { BoardPiece } from '@/contexts/GameContext';
import { useBoardSize } from '@/hooks/useBoardSize';
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
const styles = timedVisionStyles;

export default function JouerLeCoupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const boardSize = useBoardSize('wide');
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

  const goRecords = useCallback(() => {
    router.push('/visualisation/records');
  }, [router]);

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
        <TimedVisionStart
          description="Joue le coup demandé sur l’échiquier, le plus rapidement possible, pendant 60 secondes."
          record={snap.previousRecord}
          onStart={() => void beginSession()}
          onRecords={goRecords}
          startTestID="jouer-start"
        />
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
          <TimedVisionHud
            remainingSeconds={snap.remainingSeconds}
            score={snap.score.score}
            timerTestID="jouer-timer"
            scoreTestID="jouer-score"
          />
          <Text style={[styles.prompt, { color: colors.primary }]} testID="jouer-prompt">
            {snap.challenge.promptVerbal}
          </Text>
          {snap.lastFeedback === 'wrong' ? (
            <Text style={{ color: '#BE3030' }} testID="jouer-wrong">
              Incorrect — réessaie
            </Text>
          ) : null}
          <View style={[styles.boardWrap, { width: boardSize }]}>
            <ChessBoard
              board={game.board() as (BoardPiece | null)[][]}
              lastMove={null}
              selectedSquare={touchSelected}
              legalDots={legalDests}
              onSquarePress={onSquarePress}
              showCoordinates={false}
              isFlipped={boardFlipped}
              sizeMode="wide"
              size={boardSize}
            />
            <TimedVisionSideToMove label={turnLabel} testID="jouer-side-to-move" />
          </View>
        </View>
      )}

      {snap.phase === 'completed' && (
        <TimedVisionResults
          score={snap.score.score}
          isNewRecord={snap.isNewRecord}
          correctLabel="Coups correctement joués"
          correctCount={snap.score.correct}
          wrongCount={snap.score.wrong}
          record={Math.max(snap.previousRecord, snap.score.score)}
          newRecordTestID="jouer-new-record"
          resultsTestID="jouer-results"
          onRestart={() => {
            sessionRef.current.replay();
            void beginSession();
          }}
          onRecords={goRecords}
          onBack={() => {
            sessionRef.current.returnToIdle();
            sync();
            router.back();
          }}
        />
      )}
    </ScrollView>
  );
}
