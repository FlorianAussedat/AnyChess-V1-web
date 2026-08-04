import React from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { blindStyles } from '@/components/blind/blindStyles';

export function BlindStatRow({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={blindStyles.statRow}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}
