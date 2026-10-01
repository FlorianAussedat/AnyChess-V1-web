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
  disabled?: boolean;
  description?: string;
  disabledReason?: string;
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
  disabled = false,
  description,
  disabledReason,
}: Props) {
  const colors = useColors();
  const hint = disabled ? disabledReason ?? description : description;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onToggle();
      }}
      disabled={disabled}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{hint}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.control,
          {
            backgroundColor: value && !disabled ? colors.primary : colors.secondary,
            borderColor: value && !disabled ? colors.primary : colors.border,
          },
        ]}
      >
        <Ionicons
          name={value ? activeIcon : inactiveIcon}
          size={20}
          color={
            value && !disabled ? colors.primaryForeground : colors.mutedForeground
          }
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
  copy: { flex: 1, gap: 4 },
  label: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: DesignTokens.typography.weightRegular,
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
