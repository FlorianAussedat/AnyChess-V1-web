import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import type { BoardPiece } from '@/contexts/GameContext';
import { useColors } from '@/hooks/useColors';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { defaultKeyValueStorage } from '@/lib/storage';
import { parseChessVoice } from '@/lib/voice';
import {
  MoveNamingRecordsStore, MoveNamingTimer, emptyMoveNamingScore, pickMoveNamingChallenge,
  scoreMoveNamingAttempt, type MoveNamingChallenge, type MoveNamingScore,
} from '@/lib/moveNaming';

const records = new MoveNamingRecordsStore(defaultKeyValueStorage);

export default function NommerLeCoupScreen() {
  const colors = useColors();
  const router = useRouter();
  const timer = useRef(new MoveNamingTimer());
  const [seconds, setSeconds] = useState(4);
  const [challenge, setChallenge] = useState<MoveNamingChallenge | null>(null);
  const [score, setScore] = useState<MoveNamingScore>(emptyMoveNamingScore());
  const [active, setActive] = useState(false);
  const [input, setInput] = useState('');
  const [remaining, setRemaining] = useState(60);

  useEffect(() => () => timer.current.dispose(), []);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setRemaining(Math.max(0, 60 - Math.floor(timer.current.elapsedSeconds()))), 250);
    return () => clearInterval(id);
  }, [active]);

  function next(previousId?: string) {
    const nextChallenge = pickMoveNamingChallenge(previousId);
    setChallenge(nextChallenge);
    if (nextChallenge) timer.current.startChallenge(seconds, () => submitOutcome('timeout'));
  }
  function start() {
    const nextScore = emptyMoveNamingScore();
    setScore(nextScore); setRemaining(60); setActive(true);
    timer.current.startSession(60, () => { timer.current.clearChallenge(); setActive(false); });
    next();
  }
  function submitOutcome(outcome: 'correct' | 'wrong' | 'timeout' | 'recognition-failure') {
    if (!active || !challenge) return;
    timer.current.clearChallenge();
    setScore((current) => scoreMoveNamingAttempt(current, outcome));
    next(challenge.puzzleId);
  }
  function answer(raw: string) {
    if (!challenge) return;
    const result = parseChessVoice(raw, new Chess(challenge.initialFen));
    if (result.type === 'unrecognized' || result.type === 'ambiguous') {
      submitOutcome('recognition-failure');
    } else if (result.type === 'move') {
      const ok =
        result.move.from === challenge.setupMove.from &&
        result.move.to === challenge.setupMove.to;
      submitOutcome(ok ? 'correct' : 'wrong');
    } else {
      submitOutcome('wrong');
    }
    setInput('');
  }
  const { micActive, toggleMic } = useSpeechInput({ forceOff: !active, isSpeaking: false, onTranscript: answer });
  const display = challenge ? new Chess(challenge.positionFen) : null;

  useEffect(() => {
    if (!active) records.saveScore(seconds, score.score).catch(() => undefined);
  }, [active]); // save final round only

  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}>
    <Text style={[styles.title, { color: colors.foreground }]}>Nommer le coup</Text>
    {!active ? <View style={styles.gap}>
      <Text style={{ color: colors.mutedForeground }}>Réponse par coup : {seconds} s · partie : 60 s</Text>
      <View style={styles.row}>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) =>
        <Pressable key={n} onPress={() => setSeconds(n)} style={[styles.chip, { borderColor: colors.border, backgroundColor: n === seconds ? colors.primary : colors.card }]}><Text style={{ color: n === seconds ? colors.primaryForeground : colors.foreground }}>{n}</Text></Pressable>)}</View>
      <Pressable onPress={start} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground }}>Commencer</Text></Pressable>
      <Pressable onPress={() => router.push('/visualisation/records')}><Text style={{ color: colors.primary }}>Voir les records</Text></Pressable>
      {score.correct + score.wrong + score.timeouts > 0 && <Text style={{ color: colors.foreground }}>Dernier score : {score.score} (+{score.correct} / −{score.wrong}, {score.timeouts} temps écoulés)</Text>}
    </View> : <View style={styles.gap}>
      <Text style={{ color: colors.foreground }}>Temps : {remaining}s · Score : {score.score}</Text>
      {display && <ChessBoard board={display.board() as (BoardPiece | null)[][]} lastMove={challenge?.setupMove ?? null} showCoordinates={false} />}
      <Text style={{ color: colors.mutedForeground }}>Quel était le dernier coup ?</Text>
      <View style={styles.row}><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => answer(input)} placeholder="ex. Cavalier prend e5" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /><Pressable onPress={() => answer(input)} style={[styles.send, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground }}>OK</Text></Pressable></View>
      <Pressable onPress={toggleMic} style={[styles.button, { backgroundColor: micActive ? '#b33' : colors.card, borderColor: colors.border, borderWidth: 1 }]}><Text style={{ color: colors.foreground }}>{micActive ? 'Écoute…' : 'Répondre à voix haute'}</Text></Pressable>
    </View>}
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 20, gap: 16 }, title: { fontSize: 25, fontWeight: '700' }, gap: { gap: 14 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { padding: 10, borderWidth: 1, borderRadius: 8 }, button: { padding: 14, borderRadius: 10, alignItems: 'center' }, input: { flex: 1, minWidth: 180, borderWidth: 1, borderRadius: 10, padding: 12 }, send: { padding: 13, borderRadius: 10 } });
