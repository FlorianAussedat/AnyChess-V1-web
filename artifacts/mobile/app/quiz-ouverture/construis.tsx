import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { useColors } from '@/hooks/useColors';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import {
  OpeningConstructionSession,
  openingTargets,
  type ConstructionSnapshot,
  type OpeningTarget,
} from '@/lib/openingQuiz';

function makeSession(target: OpeningTarget): OpeningConstructionSession {
  return new OpeningConstructionSession(target);
}

export default function ConstruisOuvertureScreen() {
  const colors = useColors();
  const router = useRouter();
  const targets = openingTargets();
  const [target, setTarget] = useState(targets[0] ?? null);
  const session = useRef(target ? makeSession(target) : null);
  const [snap, setSnap] = useState<ConstructionSnapshot | null>(
    () => session.current?.snapshot() ?? null,
  );

  function select(next: OpeningTarget) {
    session.current = makeSession(next);
    setTarget(next);
    setSnap(session.current.snapshot());
  }
  function answer(raw: string) {
    if (session.current) setSnap(session.current.answer(raw));
  }
  const { micActive, toggleMic } = useSpeechInput({
    forceOff: snap?.phase !== 'playing',
    isSpeaking: false,
    onTranscript: (raw) => {
      if (session.current) setSnap(session.current.answer(raw));
    },
  });

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        gap: 14,
        backgroundColor: colors.background,
      }}
    >
      <BackButton onPress={() => router.back()} />
      <Text style={{ color: colors.foreground, fontSize: 25, fontWeight: '700' }}>
        Construis l’ouverture
      </Text>
      <Text style={{ color: colors.mutedForeground }}>
        Les transpositions ne sont pas encore acceptées : joue la ligne de référence exacte.
      </Text>
      <View style={{ gap: 8 }}>
        {targets.map((item) => (
          <Pressable
            key={item.identity.name}
            onPress={() => select(item)}
            style={{
              padding: 10,
              borderWidth: 1,
              borderRadius: 8,
              borderColor: colors.border,
              backgroundColor:
                target?.identity.name === item.identity.name ? colors.primary : colors.card,
            }}
          >
            <Text
              style={{
                color:
                  target?.identity.name === item.identity.name
                    ? colors.primaryForeground
                    : colors.foreground,
              }}
            >
              {item.identity.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {snap && (
        <>
          {/* Stage 4 will hide expectedSan during play — keep placeholder for Stage 1 wiring */}
          <Text style={{ color: colors.mutedForeground }}>
            Joué : {snap.playedSans.join(' ') || '—'}
          </Text>
          {snap.phase === 'playing' ? (
            <>
              <ChessAnswerInput
                onSubmit={answer}
                enabled
                persistFocus
                placeholder="Dicte ou écris le coup"
              />
              <Pressable
                onPress={toggleMic}
                style={{
                  padding: 13,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.foreground }}>
                  {micActive ? 'Écoute…' : 'Répondre à voix haute'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: snap.phase === 'complete' ? '#398a55' : '#c44' }}>
              {snap.feedback}
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
