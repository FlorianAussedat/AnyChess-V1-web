import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Variant = 'primary' | 'secondary' | 'destructive' | 'success';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared action button — primary (orange) / secondary (card) / destructive / success.
 * Disabled uses a muted dark style (never muddy orange).
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
  style,
}: Props) {
  const colors = useColors();

  let bg: string = colors.primary;
  let fg: string = colors.primaryForeground;
  let border: string = colors.primary;

  if (variant === 'secondary') {
    bg = colors.card;
    fg = colors.foreground;
    border = colors.border;
  } else if (variant === 'destructive') {
    bg = colors.destructive;
    fg = colors.destructiveForeground;
    border = colors.destructive;
  } else if (variant === 'success') {
    bg = '#398a55';
    fg = '#ffffff';
    border = '#398a55';
  }

  if (disabled) {
    bg = colors.muted;
    fg = colors.mutedForeground;
    border = colors.border;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled ? 1 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: DesignTokens.minTouchTarget,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
