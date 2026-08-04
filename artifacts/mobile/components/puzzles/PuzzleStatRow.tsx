import React from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';

export function PuzzleStatRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={puzzleStyles.statRow}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}
