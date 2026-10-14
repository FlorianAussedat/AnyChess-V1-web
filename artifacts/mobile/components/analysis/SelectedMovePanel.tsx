import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { formatAnyLyseurEval } from '@/lib/analysis/formatEval.ts';
import type { MoveReview } from '@/lib/analysis/reviewFocus.ts';
import type { EngineLine } from '@/lib/analysis/types.ts';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { ChessNotation } from '@/lib/preferences/types';
import { EngineLinesPanel } from './EngineLinesPanel';

type Props = {
  review: MoveReview;
  notation: ChessNotation;
  linesFen: string;
  lines: EngineLine[];
  status: 'pending' | 'ready' | 'unavailable' | 'terminal' | 'incomplete';
  testID?: string;
};

function evalText(
  label: string | null,
  status: Props['status'],
  pending: string,
  missing: string,
): string {
  if (label) return label;
  if (status === 'pending') return pending;
  return missing;
}

export function SelectedMovePanel({
  review,
  notation,
  linesFen,
  lines,
  status,
  testID = 'anyliseur-played-vs-best',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const pending = t('parties.anyliseurAnalyzing');
  const missing = t('parties.anyliseurEvalMissing');
  const played = formatSanForDisplay(review.playedSan, notation);
  const before = formatAnyLyseurEval(review.before ?? { cp: null, mate: null });
  const after = formatAnyLyseurEval(review.after ?? { cp: null, mate: null });
  const bestLabel = review.bestSan
    ? formatSanForDisplay(review.bestSan, notation)
    : status === 'pending'
      ? pending
      : t('parties.anyliseurBestUnavailable');
  const empty =
    status === 'pending'
      ? pending
      : status === 'terminal'
        ? t('parties.anyliseurTerminal')
        : status === 'incomplete'
          ? t('parties.anyliseurEvalIncomplete')
          : missing;

  return (
    <View style={styles.wrap} testID={testID}>
      <View
        style={[
          styles.compareBox,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <Text style={{ color: colors.foreground }} testID={`${testID}-played`}>
          {t('parties.anyliseurPlayed')}: {played}
        </Text>
        <Text style={{ color: colors.primary }} testID={`${testID}-best`}>
          {t('parties.anyliseurBest')}: {bestLabel}
        </Text>
        <Text
          style={{ color: colors.mutedForeground, fontSize: 12 }}
          testID={`${testID}-evals`}
        >
          {t('parties.anyliseurBefore')}: {evalText(before, status, pending, missing)}
          {' · '}
          {t('parties.anyliseurAfter')}: {evalText(after, review.after ? 'ready' : status, pending, missing)}
        </Text>
        <Text
          style={{ color: colors.mutedForeground, fontSize: 11 }}
          testID={`${testID}-perspective`}
        >
          {t('parties.anyliseurPerspective')}
        </Text>
      </View>
      <EngineLinesPanel
        fen={linesFen}
        lines={lines}
        notation={notation}
        title={t('parties.anyliseurPossibilities')}
        emptyLabel={empty}
        excludeUci={review.bestUci}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 10 },
  compareBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: 4,
  },
});
