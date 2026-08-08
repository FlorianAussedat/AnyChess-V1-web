import React from 'react';
import { StyleSheet, View } from 'react-native';
import { OptionChip } from '@/components/ui/OptionChip';
import type { RepertoireSide } from '@/lib/repertoire';
import { DesignTokens } from '@/constants/designTokens';
import { useTranslation } from '@/hooks/useTranslation';
import { tMsg } from '@/lib/i18n';

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
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {(['white', 'black'] as RepertoireSide[]).map((side) => (
        <OptionChip
          key={side}
          label={
            side === 'white' ? t('game.playAsWhite') : t('game.playAsBlack')
          }
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
  return side === 'white' ? tMsg('common.whites') : tMsg('common.blacks');
}
