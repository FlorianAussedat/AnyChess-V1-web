import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  label: string | null | undefined;
  testID?: string;
};

/** Compact secondary opening/variation name above the game status. */
export function OpeningVariationLabel({ label, testID = 'opening-variation-label' }: Props) {
  const colors = useColors();
  if (!label) return null;
  return (
    <Text
      testID={testID}
      numberOfLines={1}
      style={[styles.label, { color: colors.mutedForeground }]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightSemiBold,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
});
