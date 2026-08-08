/**
 * Suivi mental de position — setup + question flow.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { DiscreteSlider } from '@/components/ui/DiscreteSlider';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { GameMicButton } from '@/components/game/GameMicButton';
import { NumberedSanRows } from '@/components/moves/NumberedSanRows';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { useBoardSize } from '@/hooks/useBoardSize';
import {
  generateMentalSequenceWithQuestions,
  MentalPositionSession,
  MENTAL_FULL_MOVES_MAX,
  MENTAL_FULL_MOVES_MIN,
  mentalHalfMoveCount,
  toggleMentalPresentation,
  type MentalSnapshot,
} from '@/lib/mentalPosition';
import { sideToMoveLabel } from '@/lib/playMove';
import { OwnedEngine, createOpponentEngine } from '@/lib/engines';
import { sanToVerbal } from '@/lib/chessParser';
import { speechService } from '@/services/SpeechService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { usePreferences } from '@/hooks/usePreferences';
import { formatSanForDisplay } from '@/lib/chess/notation';
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
  const { chessNotation } = usePreferences();
  const boardSize = useBoardSize('wide');

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  const questioning = snap.phase === 'questioning';
  const showing = snap.phase === 'showing';
  const done = snap.phase === 'done';
  const showBoardPanel = (showing && showBoard) || done;

  const sideToMove = useMemo(() => {
    if (!displayFen) return null;
    try {
      return new Chess(displayFen).turn();
    } catch {
      return null;
    }
  }, [displayFen]);

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
        await speechService.speak(sanToVerbal(san));
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

  const answer = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = sessionRef.current.answer(trimmed);
    setSnap({ ...next });
  }, []);

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const handleHelp = useCallback(() => {
    sessionRef.current.recordHelp('redictate');
    void dictateSequence(snap.sans);
    setSnap({ ...sessionRef.current.snapshot() });
  }, [dictateSequence, snap.sans]);

  const { micActive, isListening, toggleMic, status: micStatus } = useSpeechInput({
    isSpeaking,
    forceOff: !questioning,
    onTranscript: (t) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      answerRef.current(t);
    },
  });

  useEffect(() => {
    if (done) {
      setDisplayFen(snap.finalFen);
      setLastMove(null);
    }
  }, [done, snap.finalFen]);

  const onToggleDictate = () => {
    const next = toggleMentalPresentation({ dictate, showBoard }, 'dictate');
    if (!next) return;
    setDictate(next.dictate);
    setShowBoard(next.showBoard);
  };

  const onToggleBoard = () => {
    const next = toggleMentalPresentation({ dictate, showBoard }, 'showBoard');
    if (!next) return;
    setDictate(next.dictate);
    setShowBoard(next.showBoard);
  };

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
      testID="mental-screen"
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

          <DiscreteSlider
            testID="mental-full-moves-slider"
            label="Coups complets"
            valueLabel={String(fullMoves)}
            minimumValue={MENTAL_FULL_MOVES_MIN}
            maximumValue={MENTAL_FULL_MOVES_MAX}
            step={1}
            value={fullMoves}
            onValueChange={setFullMoves}
            leftHint={String(MENTAL_FULL_MOVES_MIN)}
            rightHint={String(MENTAL_FULL_MOVES_MAX)}
            accessibilityLabel="Coups complets"
          />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
            {fullMoves} coups complets = {mentalHalfMoveCount(fullMoves)} demi-coups
          </Text>

          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: 'Inter_600SemiBold',
              fontSize: 11,
              letterSpacing: 0.5,
            }}
          >
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
            onToggle={onToggleDictate}
            activeIcon="volume-high"
            inactiveIcon="volume-mute-outline"
            testID="mental-dictate-toggle"
          />
          <BooleanSettingRow
            label="Afficher l'échiquier pendant la séquence"
            value={showBoard}
            onToggle={onToggleBoard}
            activeIcon="eye"
            inactiveIcon="eye-off-outline"
            testID="mental-board-toggle"
          />
          <AppButton label="Commencer" onPress={start} disabled={busy} testID="mental-start" />
          {busy ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      ) : null}

      {(showing || done) && snap.sans.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
            Séquence
          </Text>
          <NumberedSanRows sans={snap.sans} testID="mental-sequence-rows" />
        </View>
      ) : null}

      {showBoardPanel && displayFen ? (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            width: boardSize,
            gap: 6,
          }}
          testID="mental-board-panel"
        >
          <ChessBoard
            board={fenToBoard(displayFen)}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            showCoordinates={false}
            sizeMode="wide"
            size={boardSize}
          />
          {sideToMove ? (
            <Text
              style={{
                color: colors.primary,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 14,
              }}
              testID="mental-side-to-move"
            >
              {sideToMoveLabel(sideToMove)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {questioning && (
        <Text style={{ color: colors.mutedForeground }} testID="mental-question-progress">
          Question {Math.min(snap.questionIndex + 1, snap.questions.length)} /{' '}
          {snap.questions.length}
        </Text>
      )}

      {questioning && (
        <View style={{ gap: 10 }} testID="mental-question-phase">
          <Pressable
            onPress={handleHelp}
            style={[styles.helpBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name="volume-high-outline" size={18} color={colors.foreground} />
            <Text style={{ color: colors.foreground }}>Réécouter la séquence</Text>
          </Pressable>
          <Text style={[styles.prompt, { color: colors.foreground }]}>{snap.currentPrompt}</Text>
          {snap.lastFeedback ? (
            <Text
              style={{ color: colors.mutedForeground }}
              testID="mental-neutral-feedback"
            >
              {snap.lastFeedback}
            </Text>
          ) : null}

          <GameMicButton
            showRecognized={showRecognizedFlash}
            isListening={isListening}
            micActive={micActive}
            micMessage={micStatus.message}
            onToggle={toggleMic}
            testID="mental-mic"
          />

          <ChessAnswerInput
            onSubmit={(raw) => answer(raw)}
            enabled
            persistFocus
            placeholder="Réponse écrite…"
          />
        </View>
      )}

      {done && (
        <View style={{ gap: 10 }} testID="mental-results">
          <Text
            style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 18 }}
            testID="mental-final-score"
          >
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
                <Text
                  style={{
                    color: entry.correct ? colors.mutedForeground : '#c44',
                    fontSize: 13,
                  }}
                >
                  Attendu : {formatSanForDisplay(entry.expectedDisplay, chessNotation)}
                </Text>
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
  resultRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
});
