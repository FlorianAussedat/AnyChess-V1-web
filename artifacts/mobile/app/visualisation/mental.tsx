/**
 * Suivi mental de position — setup + question flow.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import {
  generateMentalSequence,
  MentalPositionSession,
  type MentalSnapshot,
} from '@/lib/mentalPosition';
import { createOpponentEngine } from '@/lib/engines';
import { sanToVerbal } from '@/lib/chessParser';
import { speechService } from '@/services/SpeechService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { defaultKeyValueStorage } from '@/lib/storage';

const RECENT_KEY = 'anychess.mental.recent.v1';

export default function MentalPositionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const { soundEnabled } = useAudioSettings();

  const sessionRef = useRef(new MentalPositionSession());
  const [snap, setSnap] = useState<MentalSnapshot>(() => sessionRef.current.snapshot());
  const [fullMoves, setFullMoves] = useState(4);
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [dictate, setDictate] = useState(true);
  const [showBoard, setShowBoard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sequenceLabel, setSequenceLabel] = useState('');

  useEffect(() => {
    const unsub = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsub();
      speechService.stop();
    };
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    speechService.stop();
    try {
      let previousKey: string | null = null;
      try {
        previousKey = await defaultKeyValueStorage.getItem(RECENT_KEY);
      } catch {
        previousKey = null;
      }

      const engine = createOpponentEngine();
      const { sans, key } = await generateMentalSequence({
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
      let next = session.loadSequence(sans);
      setSequenceLabel(sans.join(' '));
      setSnap(next);
      if (next.phase === 'error') {
        setBusy(false);
        return;
      }

      if (dictate && soundEnabled) {
        for (const san of sans) {
          speechService.speak(sanToVerbal(san), { rate: 0.92 });
        }
      }

      // After a short delay (or immediately if muted / no dictate), start questions
      const delay = dictate && soundEnabled ? Math.min(sans.length * 1200, 8000) : 400;
      setTimeout(() => {
        next = session.beginQuestions();
        setSnap({ ...next });
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
  }, [fullMoves, orientation, dictate, showBoard, soundEnabled]);

  const answer = useCallback((raw: string) => {
    const next = sessionRef.current.answer(raw);
    setSnap({ ...next });
  }, []);

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const questioning = snap.phase === 'questioning';
  const { micActive, toggleMic, status: micStatus } = useSpeechInput({
    isSpeaking,
    forceOff: !questioning,
    onTranscript: (t) => answerRef.current(t),
  });

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
      <Pressable
        onPress={() => router.back()}
        style={[styles.back, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        <Text style={{ color: colors.foreground }}>Retour</Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.foreground }]}>Suivi mental de position</Text>

      {snap.phase === 'setup' || snap.phase === 'error' ? (
        <View style={{ gap: 12 }}>
          {snap.errorMessage ? (
            <Text style={{ color: '#c44' }}>{snap.errorMessage}</Text>
          ) : null}
          <Text style={{ color: colors.mutedForeground }}>Coups complets</Text>
          <View style={styles.row}>
            {[3, 4, 5, 6].map((n) => (
              <Pressable
                key={n}
                onPress={() => setFullMoves(n)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: fullMoves === n ? colors.primary : colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: fullMoves === n ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: colors.mutedForeground }}>Orientation</Text>
          <View style={styles.row}>
            {(['w', 'b'] as const).map((c) => (
              <Pressable
                key={c}
                onPress={() => setOrientation(c)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: orientation === c ? colors.primary : colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: orientation === c ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {c === 'w' ? 'Blancs' : 'Noirs'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setDictate((v) => !v)}>
            <Text style={{ color: colors.foreground }}>
              Dicter la séquence : {dictate ? 'oui' : 'non'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setShowBoard((v) => !v)}>
            <Text style={{ color: colors.foreground }}>
              Afficher l’échiquier pendant la séquence : {showBoard ? 'oui' : 'non'}
            </Text>
          </Pressable>
          <Pressable
            onPress={start}
            disabled={busy}
            style={[styles.btn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                Commencer
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {(snap.phase === 'showing' || snap.phase === 'questioning' || snap.phase === 'done') && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Séquence</Text>
          <Text style={{ color: colors.foreground }}>{sequenceLabel}</Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
            Score : {snap.score}/{snap.answered || snap.questions.length}
          </Text>
        </View>
      )}

      {questioning && (
        <View style={{ gap: 10 }}>
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
              onSubmitEditing={() => {
                answer(manual);
                setManual('');
              }}
            />
            <Pressable
              onPress={() => {
                answer(manual);
                setManual('');
              }}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="send" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      )}

      {snap.phase === 'done' && (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>
            Terminé — score {snap.score}/{snap.questions.length}
          </Text>
          <Pressable onPress={start} style={[styles.btn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              Nouvelle séquence
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={[styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              Retour Visualisation
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  btn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
});
