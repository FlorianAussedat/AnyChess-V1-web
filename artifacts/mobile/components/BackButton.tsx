import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

interface Props {
  onPress: () => void;
  /**
   * Accessibility label only — not rendered visually.
   * Kept as `label` for backward compatibility with existing call sites.
   */
  label?: string;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Shared icon-only back control.
 * Visual label text is intentionally omitted to save space; a11y label remains.
 */
export function BackButton({
  onPress,
  label,
  accessibilityLabel,
  testID = 'back-btn',
}: Props) {
  const colors = useColors();
  const a11y = accessibilityLabel ?? label ?? 'Retour';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name="chevron-back" size={20} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: DesignTokens.headerIconButton,
    height: DesignTokens.headerIconButton,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
