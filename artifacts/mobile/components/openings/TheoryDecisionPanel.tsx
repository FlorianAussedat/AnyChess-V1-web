import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import type { OpeningTrainingState } from '@/lib/moves/OpeningOpponent';

type Props = {
  trainingState: OpeningTrainingState;
  strengthBandLabel: string;
  onRestartLine: () => void;
  onNextLine: () => void;
  onContinueVsEngine: () => void;
  onUndoThinkAgain: () => void;
  onShowExpected: () => void;
  onShowFullLine: () => void;
};

export function TheoryDecisionPanel({
  trainingState,
  strengthBandLabel,
  onRestartLine,
  onNextLine,
  onContinueVsEngine,
  onUndoThinkAgain,
  onShowExpected,
  onShowFullLine,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  if (trainingState !== 'lineComplete' && trainingState !== 'outOfTheory') {
    return null;
  }

  const continueLabel = t('openings.continueVsStockfish', { level: strengthBandLabel });

  if (trainingState === 'lineComplete') {
    return (
      <View style={styles.wrap} testID="theory-line-complete-actions">
        <ActionBtn label={t('openings.restartLine')} onPress={onRestartLine} testID="theory-restart-line" primary={false} />
        <ActionBtn label={t('openings.nextLine')} onPress={onNextLine} testID="theory-next-line" primary={false} />
        <ActionBtn label={continueLabel} onPress={onContinueVsEngine} testID="theory-continue-engine" primary />
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="theory-out-of-theory-actions">
      <ActionBtn label={continueLabel} onPress={onContinueVsEngine} testID="theory-continue-engine" primary />
      <ActionBtn
        label={t('openings.undoThinkAgain')}
        onPress={onUndoThinkAgain}
        testID="theory-undo-think"
        primary={false}
      />
      <ActionBtn
        label={t('openings.showExpectedMove')}
        onPress={onShowExpected}
        testID="theory-show-expected"
        primary={false}
      />
      <ActionBtn
        label={t('openings.showFullLine')}
        onPress={onShowFullLine}
        testID="theory-show-full-line"
        primary={false}
      />
    </View>
  );
}

function ActionBtn({
  label,
  onPress,
  testID,
  primary,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  primary: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: primary ? colors.primary : colors.card,
          borderColor: primary ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: primary ? colors.primaryForeground : colors.foreground,
          fontFamily: DesignTokens.typography.weightSemiBold,
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  btn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
});
