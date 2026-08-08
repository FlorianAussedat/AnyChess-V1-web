import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { ChessBoard } from '@/components/ChessBoard';
import { GameMicButton } from '@/components/game/GameMicButton';
import {
  TimedVisionHud,
  TimedVisionResults,
  TimedVisionSideToMove,
  TimedVisionStart,
  timedVisionStyles,
} from '@/components/visualisation/TimedVisionChrome';
import type { BoardPiece } from '@/contexts/GameContext';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { defaultKeyValueStorage } from '@/lib/storage';
import {
  MoveNamingRecordsStore,
  MoveNamingSession,
  pickMoveNamingChallenge,
  boardPerspectiveLabel,
  isFlippedForPerspective,
  type MoveNamingSnapshot,
} from '@/lib/moveNaming';
import { sideToMoveLabel } from '@/lib/playMove';

const records = new MoveNamingRecordsStore(defaultKeyValueStorage);
const styles = timedVisionStyles;

export default function NommerLeCoupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const boardSize = useBoardSize('wide');
  const sessionRef = useRef(new MoveNamingSession({ pickChallenge: pickMoveNamingChallenge }));
  const micPrimedRef = useRef(false);
  const [snap, setSnap] = useState<MoveNamingSnapshot>(() => sessionRef.current.snapshot());
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  const sync = useCallback(() => {
    setSnap(sessionRef.current.snapshot());
  }, []);

  useEffect(() => () => sessionRef.current.dispose(), []);

  useEffect(() => {
    records
      .loadBest()
      .then((best) => {
        sessionRef.current.configure({ previousRecord: best, voiceEnabled: true });
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
    if (snap.phase !== 'completed') return;
    records
      .saveScore(snap.score.score)
      .then((best) => {
        sessionRef.current.markRecordSaved(best);
        sync();
      })
      .catch(() => undefined);
  }, [snap.phase, snap.score.score, sync]);

  const beginSession = useCallback(async () => {
    micPrimedRef.current = false;
    const best = await records.loadBest().catch(() => 0);
    sessionRef.current.configure({ previousRecord: best, voiceEnabled: true });
    sessionRef.current.startCountdown();
    sync();
  }, [sync]);

  const goRecords = useCallback(() => {
    router.push('/visualisation/records');
  }, [router]);

  const { micActive, isListening, status, toggleMic, stopListening } = useSpeechInput({
    forceOff: snap.phase !== 'playing',
    enabled: true,
    isSpeaking: false,
    onTranscript: (raw) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      sessionRef.current.answer(raw);
      sync();
    },
  });

  useEffect(() => {
    if (snap.phase !== 'playing' || micPrimedRef.current) return;
    micPrimedRef.current = true;
    if (!micActive) toggleMic();
  }, [snap.phase, micActive, toggleMic]);

  const display =
    snap.phase === 'playing' && snap.challenge ? new Chess(snap.challenge.positionFen) : null;
  const perspective = snap.challenge?.boardPerspective ?? 'w';
  const perspectiveLabel = boardPerspectiveLabel(perspective);
  const boardFlipped = isFlippedForPerspective(perspective);
  const turnLabel = display ? sideToMoveLabel(display.turn()) : null;

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
      testID="nommer-screen"
    >
      <ScreenHeader
        onBack={() => {
          sessionRef.current.returnToIdle();
          sync();
          router.back();
        }}
        title="Nommer le coup"
        showSound
      />

      {snap.phase === 'idle' && (
        <TimedVisionStart
          description="Identifie autant de coups que possible en 60 secondes. Pas de limite de temps par question."
          record={snap.previousRecord}
          onStart={() => void beginSession()}
          onRecords={goRecords}
          startTestID="nommer-start"
        />
      )}

      {snap.phase === 'countdown' && (
        <View style={styles.countdownWrap} testID="nommer-countdown">
          <Text style={[styles.countdown, { color: colors.foreground }]}>
            {snap.countdownLabel}
          </Text>
        </View>
      )}

      {snap.phase === 'playing' && (
        <View style={styles.gap}>
          <TimedVisionHud
            remainingSeconds={snap.remainingSeconds}
            score={snap.score.score}
            timerTestID="nommer-timer"
            scoreTestID="nommer-score"
          />
          <Text
            style={[styles.perspective, { color: colors.mutedForeground }]}
            testID="nommer-perspective"
          >
            {perspectiveLabel}
          </Text>
          {display && (
            <View style={[styles.boardWrap, { width: boardSize }]}>
              <ChessBoard
                board={display.board() as (BoardPiece | null)[][]}
                lastMove={snap.challenge?.setupMove ?? null}
                showCoordinates={false}
                isFlipped={boardFlipped}
                sizeMode="wide"
                size={boardSize}
              />
              {turnLabel ? (
                <TimedVisionSideToMove label={turnLabel} testID="nommer-side-to-move" />
              ) : null}
            </View>
          )}
          <Text style={{ color: colors.mutedForeground }}>Quel était le dernier coup ?</Text>
          {snap.lastFeedback === 'correct' ? (
            <Text style={{ color: colors.primary }} testID="nommer-correct">
              Correct
            </Text>
          ) : null}
          {snap.lastFeedback === 'wrong' ? (
            <Text style={{ color: '#BE3030' }}>Incorrect — réessaie</Text>
          ) : null}
          {snap.lastFeedback === 'recognition-failure' ? (
            <Text style={{ color: colors.mutedForeground }}>Coup non reconnu — réessaie</Text>
          ) : null}
          <ChessAnswerInput
            onSubmit={(raw) => {
              sessionRef.current.answer(raw);
              sync();
            }}
            enabled
            persistFocus
            placeholder="ex. Cavalier prend e5"
          />
          <GameMicButton
            showRecognized={showRecognizedFlash}
            isListening={isListening}
            micActive={micActive}
            micMessage={status.message}
            onToggle={toggleMic}
            testID="nommer-mic"
          />
        </View>
      )}

      {snap.phase === 'completed' && (
        <TimedVisionResults
          score={snap.score.score}
          isNewRecord={snap.isNewRecord}
          correctLabel="Coups correctement nommés"
          correctCount={snap.score.correct}
          wrongCount={snap.score.wrong}
          record={Math.max(snap.previousRecord, snap.score.score)}
          newRecordTestID="nommer-new-record"
          resultsTestID="nommer-results"
          onRestart={() => {
            stopListening();
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
