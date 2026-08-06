import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  value: boolean;
  onToggle: () => void;
  activeIcon?: IoniconName;
  inactiveIcon?: IoniconName;
  testID?: string;
};

/**
 * Compact AnyChess boolean setting — orange when ON, dark/muted when OFF.
 * Replaces plain « oui / non » text rows.
 */
export function BooleanSettingRow({
  label,
  value,
  onToggle,
  activeIcon = 'checkmark-circle',
  inactiveIcon = 'ellipse-outline',
  testID,
}: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View
        style={[
          styles.control,
          {
            backgroundColor: value ? colors.primary : colors.secondary,
            borderColor: value ? colors.primary : colors.border,
          },
        ]}
      >
        <Ionicons
          name={value ? activeIcon : inactiveIcon}
          size={20}
          color={value ? colors.primaryForeground : colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    minHeight: DesignTokens.minTouchTarget,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  control: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
