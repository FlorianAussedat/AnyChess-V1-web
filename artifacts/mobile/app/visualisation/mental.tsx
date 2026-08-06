/**
 * Suivi mental de position — setup + question flow.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BooleanSettingRow } from '@/components/ui/BooleanSettingRow';
import { OptionChip } from '@/components/ui/OptionChip';
import { AppButton } from '@/components/ui/AppButton';
import { ChessBoard } from '@/components/ChessBoard';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { usePersistentAnswerFocus } from '@/hooks/usePersistentAnswerFocus';
import {
  generateMentalSequenceWithQuestions,
  MentalPositionSession,
  type MentalSnapshot,
} from '@/lib/mentalPosition';
import { OwnedEngine, createOpponentEngine } from '@/lib/engines';
import { sanToVerbal } from '@/lib/chessParser';
import { speechService } from '@/services/SpeechService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { defaultKeyValueStorage, StorageKeys } from '@/lib/storage';
import { replayLine } from '@/lib/replay/replayLine';

const RECENT_KEY = StorageKeys.mentalRecent.key;

function fenToBoard(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export default function MentalPositionScreen() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const router = useRouter();
  const { soundEnabled } = useAudioSettings();

  const sessionRef = useRef(new MentalPositionSession());
  const engineOwnerRef = useRef(new OwnedEngine(() => createOpponentEngine()));
  const replayRef = useRef<ReturnType<typeof replayLine> | null>(null);
  const presentationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snap, setSnap] = useState<MentalSnapshot>(() => sessionRef.current.snapshot());
  const [fullMoves, setFullMoves] = useState(4);
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [dictate, setDictate] = useState(true);
  const [showBoard, setShowBoard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sequenceLabel, setSequenceLabel] = useState('');
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  const questioning = snap.phase === 'questioning';
  const showing = snap.phase === 'showing';
  const done = snap.phase === 'done';
  const showSequenceText = showing || done;
  const showBoardPanel = (showing && showBoard) || done;

  const { inputRef, afterSubmit } = usePersistentAnswerFocus({ enabled: questioning });

  useEffect(() => {
    const unsub = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsub();
      speechService.stop();
      replayRef.current?.cancel();
      if (presentationTimerRef.current) clearTimeout(presentationTimerRef.current);
      engineOwnerRef.current.destroy();
    };
  }, []);

  // Stack may keep this screen mounted — tear down Stockfish when leaving.
  useFocusEffect(
    useCallback(() => {
      return () => {
        engineOwnerRef.current.destroy();
      };
    }, []),
  );

  const dictateSequence = useCallback(
    async (sans: string[]) => {
      if (!dictate || !soundEnabled) return;
      for (const san of sans) {
        await speechService.speak(sanToVerbal(san), { rate: 0.92 });
      }
    },
    [dictate, soundEnabled],
  );

  const startReplay = useCallback(
    (sans: string[]) => {
      replayRef.current?.cancel();
      if (!showBoard) {
        setDisplayFen(null);
        setLastMove(null);
        return;
      }
      replayRef.current = replayLine({
        moves: sans,
        intervalMs: 700,
        onPosition: (fen, _idx, san) => {
          setDisplayFen(fen);
          if (san) {
            const game = new Chess();
            for (let i = 0; i < sans.indexOf(san); i++) game.move(sans[i]);
            const m = game.move(san);
            if (m) setLastMove({ from: m.from, to: m.to });
          }
        },
        onComplete: (fen) => setDisplayFen(fen),
      });
    },
    [showBoard],
  );

  const start = useCallback(async () => {
    setBusy(true);
    speechService.stop();
    replayRef.current?.cancel();
    if (presentationTimerRef.current) clearTimeout(presentationTimerRef.current);

    try {
      let previousKey: string | null = null;
      try {
        previousKey = await defaultKeyValueStorage.getItem(RECENT_KEY);
      } catch {
        previousKey = null;
      }

      const engine = engineOwnerRef.current.ensure();
      const { sans, key } = await generateMentalSequenceWithQuestions({
        fullMoves,
        engine,
        previousKey,
      });
      await defaultKeyValueStorage.setItem(RECENT_KEY, key);

      const session = sessionRef.current;
      session.configure({
        orientation,
        showBoardDuringSequence: showBoard,
        dictateSequence: dictate,
      });
      const next = session.loadSequence(sans);
      setSequenceLabel(sans.join(' '));
      setSnap(next);
      if (next.phase === 'error') {
        setBusy(false);
        return;
      }

      startReplay(sans);
      void dictateSequence(sans);

      const delay = dictate && soundEnabled ? Math.min(sans.length * 1200, 10000) : 1200;
      presentationTimerRef.current = setTimeout(() => {
        replayRef.current?.cancel();
        setDisplayFen(null);
        setLastMove(null);
        const after = session.beginQuestions();
        setSnap({ ...after });
        setBusy(false);
      }, delay);
    } catch (err) {
      sessionRef.current.loadSequence([]);
      setSnap({
        ...sessionRef.current.snapshot(),
        phase: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  }, [fullMoves, orientation, dictate, showBoard, soundEnabled, dictateSequence, startReplay]);

  const answer = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const next = sessionRef.current.answer(trimmed);
      setSnap({ ...next });
    },
    [],
  );

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const handleHelp = useCallback(() => {
    sessionRef.current.recordHelp('redictate');
    void dictateSequence(snap.sans);
    setSnap({ ...sessionRef.current.snapshot() });
  }, [dictateSequence, snap.sans]);

  const { micActive, toggleMic, status: micStatus } = useSpeechInput({
    isSpeaking,
    forceOff: !questioning,
    onTranscript: (t) => answerRef.current(t),
  });

  const submitManual = useCallback(() => {
    answer(manual);
    afterSubmit(() => setManual(''));
  }, [answer, manual, afterSubmit]);

  useEffect(() => {
    if (done) {
      setDisplayFen(snap.finalFen);
      setLastMove(null);
    }
  }, [done, snap.finalFen]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad + 12,
        paddingBottom: bottomPad + 24,
        paddingHorizontal: 18,
        gap: 12,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        onBack={() => router.back()}
        title="Suivi mental de position"
        showSound
      />

      {snap.phase === 'setup' || snap.phase === 'error' ? (
        <View style={{ gap: 12 }}>
          {snap.errorMessage ? (
            <Text style={{ color: '#c44' }}>{snap.errorMessage}</Text>
          ) : null}
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.5 }}>
            COUPS COMPLETS
          </Text>
          <View style={styles.row}>
            {[3, 4, 5, 6].map((n) => (
              <OptionChip
                key={n}
                label={String(n)}
                active={fullMoves === n}
                onPress={() => setFullMoves(n)}
              />
            ))}
          </View>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.5 }}>
            PERSPECTIVE
          </Text>
          <View style={styles.row}>
            {(['w', 'b'] as const).map((c) => (
              <OptionChip
                key={c}
                label={c === 'w' ? 'Blancs' : 'Noirs'}
                active={orientation === c}
                onPress={() => setOrientation(c)}
              />
            ))}
          </View>
          <BooleanSettingRow
            label="Dicter la séquence"
            value={dictate}
            onToggle={() => setDictate((v) => !v)}
            activeIcon="volume-high"
            inactiveIcon="volume-mute-outline"
            testID="mental-dictate-toggle"
          />
          <BooleanSettingRow
            label="Afficher l'échiquier pendant la séquence"
            value={showBoard}
            onToggle={() => setShowBoard((v) => !v)}
            activeIcon="eye"
            inactiveIcon="eye-off-outline"
            testID="mental-board-toggle"
          />
          <AppButton label="Commencer" onPress={start} disabled={busy} testID="mental-start" />
          {busy ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      ) : null}

      {showSequenceText && sequenceLabel ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Séquence</Text>
          <Text style={{ color: colors.foreground }}>{sequenceLabel}</Text>
        </View>
      ) : null}

      {showBoardPanel && displayFen ? (
        <ChessBoard
          board={fenToBoard(displayFen)}
          lastMove={lastMove}
          isFlipped={orientation === 'b'}
          showCoordinates={false}
        />
      ) : null}

      {(showing || questioning) && (
        <Text style={{ color: colors.mutedForeground }}>
          Question {Math.min(snap.questionIndex + 1, snap.questions.length)}/{snap.questions.length}
          {questioning ? ` · Score ${snap.score}/${snap.answered}` : ''}
        </Text>
      )}

      {questioning && (
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleHelp}
            style={[styles.helpBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name="volume-high-outline" size={18} color={colors.foreground} />
            <Text style={{ color: colors.foreground }}>Réécouter la séquence</Text>
          </Pressable>
          <Text style={[styles.prompt, { color: colors.foreground }]}>{snap.currentPrompt}</Text>
          {snap.lastFeedback ? (
            <Text style={{ color: colors.mutedForeground }}>{snap.lastFeedback}</Text>
          ) : null}
          <Pressable
            onPress={toggleMic}
            style={[styles.btn, { backgroundColor: micActive ? '#C44' : colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              {micActive ? 'Écoute…' : 'Répondre à voix haute'}
            </Text>
          </Pressable>
          {micStatus.message ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{micStatus.message}</Text>
          ) : null}
          <View style={styles.row}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  flex: 1,
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              value={manual}
              onChangeText={setManual}
              placeholder="Réponse écrite…"
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={submitManual}
            />
            <Pressable
              onPress={submitManual}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="send" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      )}

      {done && (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>
            Terminé — score {snap.score}/{snap.questions.length}
            {snap.helpUsed ? ' · aide utilisée' : ''}
          </Text>
          {snap.answerLog.map((entry, i) => (
            <View
              key={`${entry.question.id}-${i}`}
              style={[
                styles.resultRow,
                {
                  borderColor: entry.correct ? '#3a7' : '#c44',
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Ionicons
                name={entry.correct ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={entry.correct ? '#3a7' : '#c44'}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.foreground }}>{entry.question.promptFr}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  Ta réponse : {entry.userAnswer || '—'}
                </Text>
                {!entry.correct ? (
                  <Text style={{ color: '#c44', fontSize: 13 }}>
                    Attendu : {entry.expectedDisplay}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          <AppButton label="Nouvelle séquence" onPress={start} />
          <AppButton label="Retour" variant="secondary" onPress={() => router.back()} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  btn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  prompt: { fontSize: 18, fontFamily: 'Inter_600SemiBold', lineHeight: 26 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
});
