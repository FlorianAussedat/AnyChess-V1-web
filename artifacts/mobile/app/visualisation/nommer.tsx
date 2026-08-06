import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BoardToolbar } from '@/components/BoardToolbar';
import { BooleanSettingRow } from '@/components/ui/BooleanSettingRow';
import { AppButton } from '@/components/ui/AppButton';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { ChessBoard } from '@/components/ChessBoard';
import type { BoardPiece } from '@/contexts/GameContext';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
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

const records = new MoveNamingRecordsStore(defaultKeyValueStorage);

export default function NommerLeCoupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const sessionRef = useRef(new MoveNamingSession({ pickChallenge: pickMoveNamingChallenge }));
  const micPrimedRef = useRef(false);
  const [snap, setSnap] = useState<MoveNamingSnapshot>(() => sessionRef.current.snapshot());

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

  // Poll during countdown (3-2-1-GO labels) and play (session clock).
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
    sessionRef.current.configure({ previousRecord: best });
    sessionRef.current.startCountdown();
    sync();
  }, [sync]);

  const { micActive, status, toggleMic, stopListening } = useSpeechInput({
    forceOff: snap.phase !== 'playing',
    enabled: snap.voiceEnabled,
    isSpeaking: false,
    onTranscript: (raw) => {
      sessionRef.current.answer(raw);
      sync();
    },
  });

  useEffect(() => {
    if (snap.phase !== 'playing' || !snap.voiceEnabled || micPrimedRef.current) return;
    micPrimedRef.current = true;
    if (!micActive) toggleMic();
  }, [snap.phase, snap.voiceEnabled, micActive, toggleMic]);

  const display =
    snap.phase === 'playing' && snap.challenge ? new Chess(snap.challenge.positionFen) : null;
  const perspective = snap.challenge?.boardPerspective ?? 'w';
  const perspectiveLabel = boardPerspectiveLabel(perspective);
  const boardFlipped = isFlippedForPerspective(perspective);

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
        <View style={styles.gap}>
          <Text style={{ color: colors.mutedForeground }}>
            Identifie autant de coups que possible en 60 secondes. Pas de limite de temps par
            question.
          </Text>
          <Text style={{ color: colors.foreground }}>
            Record actuel : {snap.previousRecord}
          </Text>
          <BooleanSettingRow
            label="Réponse vocale"
            value={snap.voiceEnabled}
            onToggle={() => {
              sessionRef.current.configure({ voiceEnabled: !snap.voiceEnabled });
              sync();
            }}
            activeIcon="mic"
            inactiveIcon="mic-off-outline"
            testID="nommer-voice-toggle"
          />
          <AppButton
            label="Commencer"
            onPress={() => void beginSession()}
            testID="nommer-start"
          />
          <Pressable onPress={() => router.push('/visualisation/records')}>
            <Text style={{ color: colors.primary }}>Voir les records</Text>
          </Pressable>
        </View>
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
          <View style={styles.hudRow}>
            <Text style={[styles.hudValue, { color: colors.foreground }]} testID="nommer-timer">
              {snap.remainingSeconds}s
            </Text>
            <Text style={[styles.hudValue, { color: colors.foreground }]} testID="nommer-score">
              Score : {snap.score.score}
            </Text>
          </View>
          <BoardToolbar
            label={perspectiveLabel}
            showCoordinates={showCoordinates}
            onToggleCoordinates={() => {
              void toggleCoordinates();
            }}
          />
          {display && (
            <ChessBoard
              board={display.board() as (BoardPiece | null)[][]}
              lastMove={snap.challenge?.setupMove ?? null}
              showCoordinates={showCoordinates}
              isFlipped={boardFlipped}
            />
          )}
          <Text style={{ color: colors.mutedForeground }}>Quel était le dernier coup ?</Text>
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
          {snap.voiceEnabled && (
            <>
              <Pressable
                onPress={toggleMic}
                style={[
                  styles.button,
                  {
                    backgroundColor: micActive ? '#b33' : colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground }}>
                  {micActive ? 'Écoute…' : 'Répondre à voix haute'}
                </Text>
              </Pressable>
              {status.message ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{status.message}</Text>
              ) : null}
            </>
          )}
        </View>
      )}

      {snap.phase === 'completed' && (
        <View style={styles.gap} testID="nommer-results">
          <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>SCORE</Text>
          <Text style={[styles.scoreValue, { color: colors.foreground }]}>{snap.score.score}</Text>
          {snap.isNewRecord ? (
            <Text style={[styles.newRecord, { color: colors.primary }]} testID="nommer-new-record">
              Nouveau record !
            </Text>
          ) : null}
          <Text style={{ color: colors.foreground }}>
            Coups correctement nommés : {snap.score.correct}
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
              stopListening();
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
  button: {
    padding: DesignTokens.spacing.md,
    borderRadius: DesignTokens.radius.sm,
    alignItems: 'center',
    minHeight: DesignTokens.minTouchTarget,
  },
  countdownWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  countdown: { fontSize: 96, fontFamily: DesignTokens.typography.weightBold },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudValue: { fontSize: 22, fontFamily: DesignTokens.typography.weightBold },
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
