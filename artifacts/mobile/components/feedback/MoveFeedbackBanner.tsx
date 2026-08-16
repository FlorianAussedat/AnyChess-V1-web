/**
 * Visible "Correct" / error banner for move-input modes.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import type { MoveFeedbackState } from '@/lib/feedback/moveFeedback';

type Props = {
  state: MoveFeedbackState;
  /** Override correct label (defaults to common.correct → "Correct"). */
  correctLabel?: string;
  testID?: string;
};

export function MoveFeedbackBanner({
  state,
  correctLabel,
  testID = 'move-feedback-banner',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  if (state.kind === 'idle') return null;

  const isOk = state.kind === 'correct';
  const label =
    state.message ??
    (isOk ? (correctLabel ?? t('common.correct')) : t('common.incorrect'));

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          backgroundColor: isOk ? 'rgba(57, 138, 85, 0.22)' : 'rgba(190, 48, 48, 0.2)',
          borderColor: isOk ? '#398a55' : colors.destructive,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: isOk ? '#5ecf84' : '#ff8a8a' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: '100%',
  },
  text: {
    fontSize: 18,
    fontFamily: DesignTokens.typography.weightBold,
    letterSpacing: 0.3,
  },
});
