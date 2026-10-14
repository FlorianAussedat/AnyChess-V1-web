import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { formatAnyLyseurEval } from '@/lib/analysis/formatEval.ts';
import { legalSuggestions } from '@/lib/analysis/reviewFocus.ts';
import type { EngineLine } from '@/lib/analysis/types.ts';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { ChessNotation } from '@/lib/preferences/types';

type Props = {
  fen: string;
  lines: EngineLine[];
  notation: ChessNotation;
  title: string;
  emptyLabel: string;
  /** UCI already shown as the best move — omitted so it is not repeated. */
  excludeUci?: string | null;
  testID?: string;
};

export function EngineLinesPanel({
  fen,
  lines,
  notation,
  title,
  emptyLabel,
  excludeUci = null,
  testID = 'anyliseur-engine-lines',
}: Props) {
  const colors = useColors();
  const suggestions = legalSuggestions(fen, lines, { excludeUci, limit: 3 });

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      testID={testID}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {suggestions.length === 0 ? (
        <Text style={{ color: colors.mutedForeground }} testID={`${testID}-empty`}>
          {emptyLabel}
        </Text>
      ) : (
        suggestions.map((line, index) => {
          const evalLabel = formatAnyLyseurEval({
            cp: line.evaluation,
            mate: line.mate,
          });
          if (!evalLabel) return null;
          return (
            <View
              key={line.uci}
              style={styles.row}
              testID={`${testID}-${index + 1}`}
            >
              <Text style={[styles.rank, { color: colors.primary }]}>
                {index + 1}.
              </Text>
              <Text style={[styles.move, { color: colors.foreground }]}>
                {formatSanForDisplay(line.san, notation)}{' '}
                <Text style={{ color: colors.primary }}>{evalLabel}</Text>
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: 8,
  },
  title: {
    fontSize: DesignTokens.typography.body,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  rank: {
    width: 20,
    fontFamily: DesignTokens.typography.weightBold,
    fontSize: 13,
  },
  move: {
    flex: 1,
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
