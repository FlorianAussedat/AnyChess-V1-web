import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { useColors } from '@/hooks/useColors';
import {
  OpeningIdentificationSession,
  type OpeningIdentificationSnapshot,
} from '@/lib/openingQuiz';

export default function QuelleOuvertureScreen() {
  const colors = useColors();
  const router = useRouter();
  const session = useRef(new OpeningIdentificationSession());
  const [snap, setSnap] = useState<OpeningIdentificationSnapshot>(() => session.current.start());
  const [input, setInput] = useState('');
  const answer = () => {
    setSnap(session.current.answer(input));
    setInput('');
  };
  const next = () =>
    setSnap(session.current.start(snap.line ? [snap.line.identity.name] : []));

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
        Quelle ouverture ?
      </Text>
      <Text style={{ color: colors.mutedForeground }}>Identifie l’ouverture après cette ligne :</Text>
      <Text style={{ color: colors.foreground, fontSize: 20 }}>{snap.line?.sans.join(' ')}</Text>
      {!snap.answered ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={answer}
            placeholder="Nom de l’ouverture"
            placeholderTextColor={colors.mutedForeground}
            style={{
              flex: 1,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.foreground,
              borderRadius: 10,
              minHeight: 44,
            }}
          />
          <Pressable
            onPress={answer}
            style={{ backgroundColor: colors.primary, padding: 13, borderRadius: 10 }}
          >
            <Text style={{ color: colors.primaryForeground }}>Valider</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ color: snap.verdict?.correct ? '#398a55' : '#c44' }}>
            {snap.verdict?.correct
              ? `Correct${snap.verdict.acceptedAs === 'family' ? ' (famille acceptée)' : ''} !`
              : 'Incorrect.'}
          </Text>
          <Text style={{ color: colors.foreground }}>Réponse : {snap.line?.identity.name}</Text>
          <Pressable
            onPress={next}
            style={{
              backgroundColor: colors.primary,
              padding: 14,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.primaryForeground }}>Nouvelle ouverture</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
