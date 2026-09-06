import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import {
  formatAnyLyseurEval,
  whiteAdvantageRatio,
  type WhiteEval,
} from '@/lib/analysis';

type Props = {
  value: WhiteEval | null;
  depth?: number | null;
  loading?: boolean;
  testID?: string;
};

export function EvalBalanceBar({
  value,
  depth,
  loading = false,
  testID = 'anyliseur-eval-bar',
}: Props) {
  const colors = useColors();
  const label = value ? formatAnyLyseurEval(value) : loading ? '…' : '—';
  const adv = useMemo(() => (value ? whiteAdvantageRatio(value) : 0.5), [value]);
  const whitePct = Math.round(Math.max(0, Math.min(1, adv)) * 100);

  return (
    <View style={styles.wrap} testID={testID}>
      <View
        style={[
          styles.track,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <View
          style={{
            height: '100%',
            width: `${whitePct}%`,
            backgroundColor: colors.foreground,
          }}
        />
      </View>
      <View style={styles.meta}>
        <Text
          style={[styles.value, { color: colors.primary }]}
          testID={`${testID}-value`}
        >
          {label}
        </Text>
        {depth != null && depth > 0 ? (
          <Text style={[styles.depth, { color: colors.mutedForeground }]}>
            d{depth}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 560, gap: DesignTokens.spacing.xs },
  track: {
    height: 10,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  value: {
    fontSize: DesignTokens.typography.body,
    fontFamily: DesignTokens.typography.weightBold,
  },
  depth: {
    fontSize: DesignTokens.typography.micro,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
