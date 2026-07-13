import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  onReveal?: () => void;
}

/**
 * Shown in place of the chessboard when the eye toggle hides it.
 *
 * Occupies the same footprint as the board so the layout does not jump, and
 * makes clear the game is still running — only the visual board is hidden.
 */
export function HiddenBoardPlaceholder({ onReveal }: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 20, 352);

  return (
    <View
      style={[
        styles.wrapper,
        { width: size, height: size, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons name="eye-off-outline" size={40} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>Échiquier masqué</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        La partie continue normalement.
      </Text>
      {onReveal && (
        <Pressable
          onPress={onReveal}
          style={({ pressed }) => [
            styles.revealBtn,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="eye-outline" size={16} color={colors.foreground} />
          <Text style={[styles.revealLabel, { color: colors.foreground }]}>Afficher</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  revealBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  revealLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
