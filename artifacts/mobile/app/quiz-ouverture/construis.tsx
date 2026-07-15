import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { OpeningConstructionSession, openingTargets, type ConstructionSnapshot, type OpeningTarget } from '@/lib/openingQuiz';

function makeSession(target: OpeningTarget): OpeningConstructionSession { return new OpeningConstructionSession(target); }
export default function ConstruisOuvertureScreen() {
  const colors = useColors();
  const targets = openingTargets();
  const [target, setTarget] = useState(targets[0] ?? null);
  const session = useRef(target ? makeSession(target) : null);
  const [snap, setSnap] = useState<ConstructionSnapshot | null>(() => session.current?.snapshot() ?? null);
  const [input, setInput] = useState('');
  function select(next: OpeningTarget) { session.current = makeSession(next); setTarget(next); setSnap(session.current.snapshot()); setInput(''); }
  function answer() { if (session.current) setSnap(session.current.answer(input)); setInput(''); }
  const { micActive, toggleMic } = useSpeechInput({ forceOff: snap?.phase !== 'playing', isSpeaking: false, onTranscript: (raw) => {
    if (session.current) setSnap(session.current.answer(raw));
  } });
  return <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 14, backgroundColor: colors.background }}>
    <Text style={{ color: colors.foreground, fontSize: 25, fontWeight: '700' }}>Construis l’ouverture</Text>
    <Text style={{ color: colors.mutedForeground }}>Les transpositions ne sont pas encore acceptées : joue la ligne de référence exacte.</Text>
    <View style={{ gap: 8 }}>{targets.map((item) => <Pressable key={item.identity.name} onPress={() => select(item)} style={{ padding: 10, borderWidth: 1, borderRadius: 8, borderColor: colors.border, backgroundColor: target?.identity.name === item.identity.name ? colors.primary : colors.card }}><Text style={{ color: target?.identity.name === item.identity.name ? colors.primaryForeground : colors.foreground }}>{item.identity.name}</Text></Pressable>)}</View>
    {snap && <><Text style={{ color: colors.foreground }}>À jouer : {snap.expectedSan ?? 'terminé'}</Text><Text style={{ color: colors.mutedForeground }}>Joué : {snap.playedSans.join(' ') || '—'}</Text>{snap.phase === 'playing' ? <><View style={{ flexDirection: 'row', gap: 8 }}><TextInput value={input} onChangeText={setInput} onSubmitEditing={answer} placeholder="Dicte ou écris le coup" placeholderTextColor={colors.mutedForeground} style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.foreground }} /><Pressable onPress={answer} style={{ padding: 13, borderRadius: 10, backgroundColor: colors.primary }}><Text style={{ color: colors.primaryForeground }}>Jouer</Text></Pressable></View><Pressable onPress={toggleMic} style={{ padding: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.foreground }}>{micActive ? 'Écoute…' : 'Répondre à voix haute'}</Text></Pressable></> : <Text style={{ color: snap.phase === 'complete' ? '#398a55' : '#c44' }}>{snap.feedback}</Text>}</>}
  </ScrollView>;
}
