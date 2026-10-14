/**
 * The single /5 grade shown after a theoretical endgame.
 * The result title stays separate. A missing grade is never rendered as 0.
 */
import React from 'react';
import { Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { formatComprehensionScore } from '../domain/comprehensionScore.ts';

type Props = {
  score: number | null;
  pending?: boolean;
};

export function TheoreticalAttemptNote({ score, pending = false }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  if (typeof score === 'number') {
    return (
      <Text style={{ color: colors.foreground, textAlign: 'center' }} testID="theoretical-attempt-note">
        {t('quiz.theoreticalAttemptNote', { score: formatComprehensionScore(score) })}
      </Text>
    );
  }
  if (pending) {
    return (
      <Text style={{ color: colors.foreground, textAlign: 'center' }} testID="theoretical-score-pending">
        {t('quiz.theoreticalScorePending')}
      </Text>
    );
  }
  return null;
}
