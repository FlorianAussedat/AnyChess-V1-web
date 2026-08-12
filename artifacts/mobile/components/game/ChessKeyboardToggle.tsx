/**
 * Single shared control that shows/hides the chess move keypad
 * (or toggles Classic ↔ keypad on Classic Game).
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';

export type ChessKeyboardToggleVariant = 'visibility' | 'classic';

type Props = {
  /** True when the chess keypad is currently shown / keypad mode is active. */
  active: boolean;
  onToggle: () => void;
  /**
   * visibility — same keypad icon; style reflects open/closed (default).
   * classic — Classic Game: keypad icon when closed, create icon when open.
   */
  variant?: ChessKeyboardToggleVariant;
  disabled?: boolean;
  testID?: string;
  size?: number;
};

export function ChessKeyboardToggle({
  active,
  onToggle,
  variant = 'visibility',
  disabled = false,
  testID = 'chess-keyboard-toggle',
  size = DesignTokens.chessScreen.toggleSize,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  const accessibilityLabel =
    variant === 'classic'
      ? active
        ? t('keypad.showClassic')
        : t('keypad.show')
      : active
        ? t('keypad.hide')
        : t('keypad.show');

  const iconName =
    variant === 'classic'
      ? active
        ? 'create-outline'
        : 'keypad-outline'
      : 'keypad-outline';

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          backgroundColor: active ? colors.accent : colors.secondary,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={iconName} size={20} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
