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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
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
