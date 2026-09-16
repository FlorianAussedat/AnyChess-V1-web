import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import {
  formatAnyLyseurEval,
  uciPvToSan,
  type EngineLine,
} from '@/lib/analysis';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { ChessNotation } from '@/lib/preferences/types';

type Props = {
  fen: string;
  lines: EngineLine[];
  notation: ChessNotation;
  detailedCount?: number;
  testID?: string;
};

export function EngineLinesPanel({
  fen,
  lines,
  notation,
  detailedCount = 2,
  testID = 'anyliseur-engine-lines',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = lines.slice(0, 3);

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      testID={testID}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t('parties.anyliseurBestMoves')}
      </Text>
      {visible.length === 0 ? (
        <Text style={{ color: colors.mutedForeground }}>
          {t('parties.anyliseurWaiting')}
        </Text>
      ) : (
        visible.map((line, index) => {
          const showPv = expanded || index < detailedCount;
          const sans = uciPvToSan(fen, line.pv, showPv ? 8 : 1).map((san) =>
            formatSanForDisplay(san, notation),
          );
          const evalLabel = formatAnyLyseurEval({
            cp: line.scoreCp,
            mate: line.mate,
          });
          return (
            <View
              key={line.rank}
              style={styles.row}
              testID={`${testID}-${line.rank}`}
            >
              <Text style={[styles.rank, { color: colors.primary }]}>
                {line.rank}.
              </Text>
              <View style={styles.body}>
                <Text style={[styles.move, { color: colors.foreground }]}>
                  {sans[0] ?? '—'}{' '}
                  <Text style={{ color: colors.primary }}>{evalLabel}</Text>
                </Text>
                {showPv && sans.length > 1 ? (
                  <Text
                    style={[styles.pv, { color: colors.mutedForeground }]}
                    numberOfLines={2}
                  >
                    {sans.join(' ')}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
      {visible.length > detailedCount ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          testID={`${testID}-toggle`}
        >
          <Text
            style={{
              color: colors.primary,
              fontFamily: DesignTokens.typography.weightSemiBold,
            }}
          >
            {expanded
              ? t('parties.anyliseurLess')
              : t('parties.anyliseurMore')}
          </Text>
        </Pressable>
      ) : null}
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
  body: { flex: 1, gap: 2 },
  move: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  pv: { fontSize: 12, lineHeight: 16 },
});
