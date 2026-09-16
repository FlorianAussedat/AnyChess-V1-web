import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

/**
 * Compact selectable chip (filters, strength bands, option rows).
 */
export function OptionChip({
  label,
  active,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: DesignTokens.typography.weightSemiBold,
          color: active ? colors.primaryForeground : colors.foreground,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: DesignTokens.spacing.sm,
  },
});
