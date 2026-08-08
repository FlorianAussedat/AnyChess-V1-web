/**
 * Shared chrome for Nommer le coup / Jouer le coup — layout only.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

export function TimedVisionStart({
  description,
  record,
  onStart,
  onRecords,
  startTestID,
}: {
  description: string;
  record: number;
  onStart: () => void;
  onRecords: () => void;
  startTestID: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.gap} testID="timed-vision-start">
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 20 }}>
        {description}
      </Text>
      <Text
        style={{ color: colors.foreground, fontFamily: DesignTokens.typography.weightSemiBold }}
        testID="timed-vision-record"
      >
        Record actuel : {record}
      </Text>
      <AppButton label="Commencer" onPress={onStart} testID={startTestID} />
      <AppButton
        label="Voir les records"
        variant="secondary"
        onPress={onRecords}
        testID="timed-vision-records"
      />
    </View>
  );
}

export function TimedVisionHud({
  remainingSeconds,
  score,
  timerTestID,
  scoreTestID,
}: {
  remainingSeconds: number;
  score: number;
  timerTestID: string;
  scoreTestID: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.hudRow} testID="timed-vision-hud">
      <Text style={[styles.hudValue, { color: colors.foreground }]} testID={timerTestID}>
        {remainingSeconds}s
      </Text>
      <Text style={[styles.hudValue, { color: colors.foreground }]} testID={scoreTestID}>
        Score : {score}
      </Text>
    </View>
  );
}

export function TimedVisionResults({
  score,
  isNewRecord,
  correctLabel,
  correctCount,
  wrongCount,
  record,
  newRecordTestID,
  resultsTestID,
  onRestart,
  onRecords,
  onBack,
}: {
  score: number;
  isNewRecord: boolean;
  correctLabel: string;
  correctCount: number;
  wrongCount: number;
  record: number;
  newRecordTestID: string;
  resultsTestID: string;
  onRestart: () => void;
  onRecords: () => void;
  onBack: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.gap} testID={resultsTestID}>
      <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>SCORE</Text>
      <Text style={[styles.scoreValue, { color: colors.foreground }]}>{score}</Text>
      {isNewRecord ? (
        <Text style={[styles.newRecord, { color: colors.primary }]} testID={newRecordTestID}>
          Nouveau record !
        </Text>
      ) : null}
      <Text style={{ color: colors.foreground }}>
        {correctLabel} : {correctCount}
      </Text>
      <Text style={{ color: colors.foreground }}>Incorrect : {wrongCount}</Text>
      <Text style={{ color: colors.mutedForeground }}>Record : {record}</Text>
      <AppButton label="Recommencer" onPress={onRestart} testID="timed-vision-restart" />
      <AppButton
        label="Voir les records"
        variant="secondary"
        onPress={onRecords}
        testID="timed-vision-results-records"
      />
      <AppButton label="Retour" variant="secondary" onPress={onBack} />
    </View>
  );
}

export function TimedVisionSideToMove({
  label,
  testID,
}: {
  label: string;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.primary,
        fontFamily: DesignTokens.typography.weightSemiBold,
        fontSize: 14,
        textAlign: 'center',
      }}
      testID={testID}
    >
      {label}
    </Text>
  );
}

export const timedVisionStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.lg,
  },
  gap: { gap: DesignTokens.spacing.md },
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
  prompt: {
    fontSize: 28,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
  },
  boardWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
  },
  perspective: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
});

const styles = timedVisionStyles;
