import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  onPress: () => void;
  /** Visible label — default "Retour". */
  label?: string;
  /** Accessibility / test id. */
  testID?: string;
}

/**
 * Shared back control for mode and result screens.
 * Prefer this over one-off header chevrons so every screen stays escapable.
 */
export function BackButton({
  onPress,
  label = 'Retour',
  testID = 'back-btn',
}: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name="chevron-back" size={20} color={colors.foreground} />
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
});
