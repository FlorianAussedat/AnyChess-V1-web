import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  visible: boolean;
  onToggle: () => void;
}

/**
 * Eye toggle that shows / hides the visual chessboard.
 *
 * Open eye  = board visible.
 * Closed eye = board hidden.
 *
 * This only controls presentation — hiding the board must never reset or
 * pause the game. Reused by Classic and Opening modes.
 */
export function BoardVisibilityToggle({ visible, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      testID="board-visibility-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={visible ? 'Masquer l’échiquier' : 'Afficher l’échiquier'}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: visible ? colors.card : colors.primary,
          borderColor: visible ? colors.border : colors.primary,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons
        name={visible ? 'eye-outline' : 'eye-off-outline'}
        size={20}
        color={visible ? colors.foreground : colors.primaryForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
