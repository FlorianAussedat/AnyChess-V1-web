import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  visible: boolean;
  onToggle: () => void;
}

/**
 * Toggle that shows / hides chessboard file (a–h) and rank (1–8) labels.
 *
 * Grid icon filled = coordinates visible.
 * Grid icon outline = coordinates hidden.
 *
 * Independent from BoardVisibilityToggle — never hides the board itself.
 */
export function BoardCoordinatesToggle({ visible, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      testID="board-coordinates-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={
        visible ? 'Masquer les coordonnées' : 'Afficher les coordonnées'
      }
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
        name={visible ? 'grid-outline' : 'grid'}
        size={18}
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
