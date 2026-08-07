import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandAssets } from '@/constants/BrandAssets';
import { useColors } from '@/hooks/useColors';
import type { SideChoice } from '@/lib/game/types';

type Props = {
  pendingSide: SideChoice;
  onPickSide: (side: SideChoice) => void;
  /** Extra content under the side pills (e.g. Classic strength bands). */
  children?: React.ReactNode;
};

const OPTIONS = [
  { id: 'w' as SideChoice, label: 'Blancs', icon: BrandAssets.sides.white },
  { id: 'b' as SideChoice, label: 'Noirs', icon: BrandAssets.sides.black },
  { id: 'random' as SideChoice, label: 'Aléatoire', icon: BrandAssets.sides.random },
] as const;

export function GameSidePicker({ pendingSide, onPickSide, children }: Props) {
  const colors = useColors();

  return (
    <View style={styles.setupBlock}>
      <Text style={[styles.setupLabel, { color: colors.mutedForeground }]}>Tu joues :</Text>
      <View style={styles.colorRow}>
        {OPTIONS.map((opt) => {
          const active = pendingSide === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[
                styles.sidePill,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onPickSide(opt.id)}
              testID={
                opt.id === 'w' ? 'color-white' : opt.id === 'b' ? 'color-black' : 'color-random'
              }
            >
              <Image source={opt.icon} style={styles.sidePillIcon} />
              <Text
                style={[
                  styles.colorPillText,
                  { color: active ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  setupBlock: { gap: 6 },
  setupLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorRow: { flexDirection: 'row', gap: 8 },
  sidePill: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sidePillIcon: { width: 48, height: 48 },
  colorPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
