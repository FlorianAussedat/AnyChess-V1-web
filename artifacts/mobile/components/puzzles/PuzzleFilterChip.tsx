import React from 'react';
import { Pressable, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';

export function PuzzleFilterChip({
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
        puzzleStyles.chip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Inter_600SemiBold',
          color: active ? colors.primaryForeground : colors.foreground,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
