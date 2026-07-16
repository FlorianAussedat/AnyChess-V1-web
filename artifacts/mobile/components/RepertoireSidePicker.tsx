import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { RepertoireSide } from '@/lib/repertoire';

type Props = {
  value: RepertoireSide | null;
  onChange: (side: RepertoireSide) => void;
  disabled?: boolean;
};

export function RepertoireSidePicker({ value, onChange, disabled }: Props) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      {(['white', 'black'] as RepertoireSide[]).map((side) => {
        const active = value === side;
        return (
          <Pressable
            key={side}
            onPress={() => !disabled && onChange(side)}
            disabled={disabled}
            style={[
              styles.btn,
              {
                backgroundColor: active ? colors.primary : colors.input,
                borderColor: active ? colors.primary : colors.border,
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 14,
                color: active ? colors.primaryForeground : colors.foreground,
              }}
            >
              {side === 'white' ? '♔ Blancs' : '♚ Noirs'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function sideLabel(side: RepertoireSide): string {
  return side === 'white' ? 'Blancs' : 'Noirs';
}
