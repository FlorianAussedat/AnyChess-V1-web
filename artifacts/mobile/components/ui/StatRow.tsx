import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

/**
 * Shared label/value row used by Blind and Puzzles result panels.
 */
export function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: DesignTokens.typography.weightRegular,
          fontSize: 13,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: DesignTokens.typography.weightSemiBold,
          fontSize: 14,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.sm - 2,
    gap: DesignTokens.spacing.sm,
  },
});
