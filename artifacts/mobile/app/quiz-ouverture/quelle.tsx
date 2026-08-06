import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';
import {
  OpeningIdentificationSession,
  groupOpeningSans,
  type OpeningIdentificationSnapshot,
} from '@/lib/openingQuiz';

export default function QuelleOuvertureScreen() {
  const colors = useColors();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const session = useRef(new OpeningIdentificationSession());
  const [snap, setSnap] = useState<OpeningIdentificationSnapshot>(() => session.current.start());
  const [input, setInput] = useState('');
  const answer = () => {
    setSnap(session.current.answer(input));
    setInput('');
  };
  const next = () =>
    setSnap(session.current.start(snap.line ? [snap.line.identity.name] : []));

  const moveRows = groupOpeningSans(snap.line?.sans ?? []);

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
    >
      <ScreenHeader onBack={() => router.back()} title="Quelle ouverture ?" />
      <Text style={{ color: colors.mutedForeground }}>
        Identifie l’ouverture après cette ligne :
      </Text>
      <View
        style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="quelle-move-rows"
      >
        {moveRows.map((row) => (
          <View key={row.moveNumber} style={styles.moveRow}>
            <Text style={[styles.moveNum, { color: colors.mutedForeground }]}>
              {row.moveNumber}.
            </Text>
            <Text style={[styles.moveSan, { color: colors.foreground }]}>
              {row.white ?? ''}
            </Text>
            <Text style={[styles.moveSan, { color: colors.foreground }]}>
              {row.black ? `...${row.black}` : ''}
            </Text>
          </View>
        ))}
      </View>
      {!snap.answered ? (
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={answer}
            placeholder="Nom de l’ouverture"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          />
          <AppButton label="Valider" onPress={answer} style={styles.validate} />
        </View>
      ) : (
        <View style={{ gap: DesignTokens.spacing.sm }}>
          <Text style={{ color: snap.verdict?.correct ? '#398a55' : '#c44' }}>
            {snap.verdict?.correct
              ? `Correct${snap.verdict.acceptedAs === 'family' ? ' (famille acceptée)' : ''} !`
              : 'Incorrect.'}
          </Text>
          <Text style={{ color: colors.foreground }}>Réponse : {snap.line?.identity.name}</Text>
          <AppButton label="Nouvelle ouverture" onPress={next} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.md,
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.sm,
  },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: DesignTokens.spacing.md },
  moveNum: {
    width: 28,
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 16,
  },
  moveSan: {
    flex: 1,
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 18,
  },
  inputRow: { flexDirection: 'row', gap: DesignTokens.spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    paddingHorizontal: DesignTokens.spacing.md,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    minHeight: DesignTokens.minTouchTarget,
  },
  validate: { paddingHorizontal: DesignTokens.spacing.md },
});
