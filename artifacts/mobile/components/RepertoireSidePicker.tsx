import React from 'react';
import { StyleSheet, View } from 'react-native';
import { OptionChip } from '@/components/ui/OptionChip';
import type { RepertoireSide } from '@/lib/repertoire';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  value: RepertoireSide | null;
  onChange: (side: RepertoireSide) => void;
  disabled?: boolean;
};

/**
 * Fixed White / Black repertoire side — NO random.
 * Persistent import/migration data, not pre-game camp selection.
 */
export function RepertoireSidePicker({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      {(['white', 'black'] as RepertoireSide[]).map((side) => (
        <OptionChip
          key={side}
          label={side === 'white' ? 'Je joue Blancs' : 'Je joue Noirs'}
          active={value === side}
          onPress={() => {
            if (!disabled) onChange(side);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: DesignTokens.spacing.sm },
});

export function sideLabel(side: RepertoireSide): string {
  return side === 'white' ? 'Blancs' : 'Noirs';
}

/** Short CTA labels for import / migration ("I play White/Black"). */
export function sidePlayLabel(side: RepertoireSide): string {
  return side === 'white' ? 'Je joue Blancs' : 'Je joue Noirs';
}
