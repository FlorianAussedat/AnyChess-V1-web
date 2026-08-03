import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { BackButton } from '@/components/BackButton';
import { SoundToggle } from '@/components/SoundToggle';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import type { BoardPiece } from '@/contexts/GameContext';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useColors } from '@/hooks/useColors';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { defaultKeyValueStorage } from '@/lib/storage';
import {
  MoveNamingRecordsStore,
  MoveNamingSession,
  pickMoveNamingChallenge,
  type MoveNamingSnapshot,
} from '@/lib/moveNaming';

const records = new MoveNamingRecordsStore(defaultKeyValueStorage);

export default function NommerLeCoupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const sessionRef = useRef(new MoveNamingSession({ pickChallenge: pickMoveNamingChallenge }));
  const micPrimedRef = useRef(false);
  const [snap, setSnap] = useState<MoveNamingSnapshot>(() => sessionRef.current.snapshot());

  const sync = useCallback(() => {
    setSnap(sessionRef.current.snapshot());
  }, []);

  useEffect(() => () => sessionRef.current.dispose(), []);

  // Poll during countdown (3-2-1-GO labels) and play (session clock + challenge timeouts).
  useEffect(() => {
    if (snap.phase !== 'countdown' && snap.phase !== 'playing') return;
    const id = setInterval(sync, snap.phase === 'countdown' ? 100 : 250);
    return () => clearInterval(id);
  }, [snap.phase, sync]);

  useEffect(() => {
    if (snap.phase !== 'completed') return;
    records.saveScore(snap.responseSeconds, snap.score.score).catch(() => undefined);
  }, [snap.phase, snap.responseSeconds, snap.score.score]);

  const beginSession = useCallback(async () => {
    micPrimedRef.current = false;
    const current = sessionRef.current.snapshot();
    const loaded = await records.load().catch(() => ({} as Record<number, number>));
    sessionRef.current.configure({
      previousRecord: loaded[current.responseSeconds] ?? 0,
    });
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

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <BackButton
          onPress={() => {
            sessionRef.current.returnToIdle();
            sync();
            router.back();
          }}
          label="Retour"
        />
        <SoundToggle />
      </View>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Nommer le coup</Text>
        <BoardCoordinatesToggle
          visible={showCoordinates}
          onToggle={() => {
            void toggleCoordinates();
          }}
        />
      </View>

      {snap.phase === 'idle' && (
        <View style={styles.gap}>
          <Text style={{ color: colors.mutedForeground }}>
            Réponse par coup : {snap.responseSeconds} s · partie : 60 s
          </Text>
          <View style={styles.row}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  sessionRef.current.configure({ responseSeconds: n });
                  sync();
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: n === snap.responseSeconds ? colors.primary : colors.card,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      n === snap.responseSeconds ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => {
              sessionRef.current.configure({ voiceEnabled: !snap.voiceEnabled });
              sync();
            }}
            style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Text style={{ color: colors.foreground }}>
              Réponse vocale : {snap.voiceEnabled ? 'activée' : 'désactivée'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void beginSession()}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground }}>Commencer</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/visualisation/records')}>
            <Text style={{ color: colors.primary }}>Voir les records</Text>
          </Pressable>
        </View>
      )}

      {snap.phase === 'countdown' && (
        <View style={styles.countdownWrap}>
          <Text style={[styles.countdown, { color: colors.foreground }]}>
            {snap.countdownLabel}
          </Text>
        </View>
      )}

      {snap.phase === 'playing' && (
        <View style={styles.gap}>
          <Text style={{ color: colors.foreground }}>
            Temps : {snap.remainingSeconds}s · Score : {snap.score.score}
          </Text>
          {display && (
            <ChessBoard
              board={display.board() as (BoardPiece | null)[][]}
              lastMove={snap.challenge?.setupMove ?? null}
              showCoordinates={showCoordinates}
            />
          )}
          <Text style={{ color: colors.mutedForeground }}>Quel était le dernier coup ?</Text>
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
        <View style={styles.gap}>
          <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>SCORE</Text>
          <Text style={[styles.scoreValue, { color: colors.foreground }]}>{snap.score.score}</Text>
          {snap.isNewRecord ? (
            <Text style={[styles.newRecord, { color: colors.primary }]}>Nouveau record !</Text>
          ) : null}
          <Text style={{ color: colors.foreground }}>Correct : {snap.score.correct}</Text>
          <Text style={{ color: colors.foreground }}>Incorrect : {snap.score.wrong}</Text>
          <Text style={{ color: colors.foreground }}>Temps écoulés : {snap.score.timeouts}</Text>
          <Text style={{ color: colors.foreground }}>
            Échecs de reconnaissance : {snap.score.recognitionFailures}
          </Text>
          <Pressable
            onPress={() => {
              sessionRef.current.returnToIdle();
              sync();
              router.back();
            }}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground }}>Retour</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/visualisation/records')}
            style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ color: colors.foreground }}>Voir les records</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              stopListening();
              void beginSession();
            }}
            style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ color: colors.foreground }}>Rejouer</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 25, fontWeight: '700', flex: 1 },
  gap: { gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { padding: 10, borderWidth: 1, borderRadius: 8 },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
  toggleRow: { padding: 14, borderRadius: 10, borderWidth: 1 },
  countdownWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  countdown: { fontSize: 96, fontWeight: '800' },
  scoreLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 2, textAlign: 'center' },
  scoreValue: { fontSize: 64, fontWeight: '800', textAlign: 'center' },
  newRecord: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
});
