import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import { groupOpeningSans } from '@/lib/openingQuiz/groupOpeningSans';

type Props = {
  sans: readonly string[];
  testID?: string;
};

/**
 * Numbered White/Black SAN rows (shared with Quelle ouverture style).
 * Does not mutate SAN strings — layout only.
 */
export function NumberedSanRows({ sans, testID }: Props) {
  const colors = useColors();
  const rows = groupOpeningSans(sans);

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      {rows.map((row) => (
        <View key={row.moveNumber} style={styles.row}>
          <Text style={[styles.num, { color: colors.mutedForeground }]}>{row.moveNumber}.</Text>
          <Text style={[styles.san, { color: colors.foreground }]}>{row.white ?? ''}</Text>
          <Text style={[styles.san, { color: colors.foreground }]}>
            {row.black ?? ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: DesignTokens.spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
  },
  num: {
    width: 28,
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  san: {
    flex: 1,
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
