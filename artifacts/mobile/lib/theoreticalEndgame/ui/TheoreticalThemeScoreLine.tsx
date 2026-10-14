/**
 * Score block of a theoretical-endgame theme card.
 * A missing average stays —/5. Pending and failed grades say so.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import {
  formatComprehensionScore,
  type ThemeScoreSummary,
} from '../domain/comprehensionScore.ts';

export const EMPTY_THEME_SCORE: ThemeScoreSummary = {
  score: 0,
  count: 0,
  estimatedScore: 0,
  estimatedCount: 0,
  attemptCount: 0,
  winCount: 0,
  pendingCount: 0,
  failedCount: 0,
};

type Props = {
  themeId: string;
  summary: ThemeScoreSummary;
  masteredLabel?: string;
  align?: 'center' | 'left';
  onRecalculate?: () => void;
};

export function TheoreticalThemeScoreLine({
  themeId,
  summary,
  masteredLabel,
  align = 'center',
  onRecalculate,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const pendingLabel = t('quiz.theoreticalScorePending');
  const dash = t('quiz.theoreticalNoAttempts');
  const textAlign = align === 'center' ? 'center' : 'left';
  const headline =
    summary.count > 0
      ? t('quiz.theoreticalAverage', { score: formatComprehensionScore(summary.score) })
      : dash;
  const showPendingAside = summary.pendingCount > 0;
  const showRecalculate = summary.failedCount > 0 && onRecalculate != null;

  return (
    <View testID={`theoretical-theme-score-block-${themeId}`}>
      <Text
        style={{ color: colors.mutedForeground, fontSize: align === 'center' ? 16 : 13, textAlign }}
        testID={`theoretical-theme-score-${themeId}`}
      >
        {summary.count > 0 && masteredLabel ? `${headline} · ${masteredLabel}` : headline}
      </Text>
      {showPendingAside && (
        <Text
          style={{ color: colors.foreground, fontSize: 12, textAlign }}
          testID={`theoretical-theme-score-pending-${themeId}`}
        >
          {pendingLabel}
        </Text>
      )}
      {summary.attemptCount > 0 && (
        <Text
          style={{ color: colors.mutedForeground, fontSize: 12, textAlign }}
          testID={`theoretical-theme-attempts-${themeId}`}
        >
          {t('quiz.theoreticalAttemptWins', {
            attempts: summary.attemptCount,
            wins: summary.winCount,
          })}
        </Text>
      )}
      {showRecalculate && (
        <Pressable
          onPress={onRecalculate}
          hitSlop={8}
          testID={`theoretical-theme-recalculate-${themeId}`}
        >
          <Text style={{ color: colors.primary, fontSize: 13, textAlign }}>
            {t('quiz.theoreticalRecalculate')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
