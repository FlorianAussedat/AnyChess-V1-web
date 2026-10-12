import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { EvalBalanceBar } from '@/components/analysis';
import type { ChessNotation } from '@/lib/chess/notation';
import type { AttemptResult, DefenderColor } from '@/lib/endgameTraining/domain/types';
import {
  buildDiagnosticView,
  formatReviewEval,
  reviewHeadlineKey,
  showReviewGauge,
  type EvalDisplay,
} from '@/lib/endgameTraining/domain/reviewDiagnostic';
import { defenderToWhiteEval } from '@/lib/endgameTraining/ui/toWhiteEval';

function evalText(
  display: EvalDisplay,
  missingLabel: string,
): string {
  if (display.kind === 'missing') return missingLabel;
  return display.text;
}

export function DefendDrawReviewCard({
  result,
  defender,
  notation,
  testID = 'endgame-result',
}: {
  result: AttemptResult;
  defender: DefenderColor;
  notation: ChessNotation;
  testID?: string;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const headline = t(
    reviewHeadlineKey({
      outcome: result.outcome,
      officialDrawReason: result.officialDrawReason,
      checkmateWinner: result.checkmateWinner,
      playerColor: defender,
    }),
  );
  const diagnostic = buildDiagnosticView(result, defender, notation);
  const gauge = showReviewGauge(result.outcome);
  const last = result.timeline.length ? result.timeline[result.timeline.length - 1] : null;
  const whiteEval = last
    ? defenderToWhiteEval(last.scoreCp, last.mateIn, defender)
    : null;
  const missing = t('quiz.ddEvalMissing');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID={testID}
    >
      <Text
        style={[styles.headline, { color: colors.foreground }]}
        testID="endgame-result-headline"
      >
        {headline}
      </Text>
      <Text style={[styles.secondary, { color: colors.mutedForeground }]} testID="endgame-moves-resisted">
        {t('quiz.endgameMovesResisted', { count: result.movesResisted })}
      </Text>

      {gauge && whiteEval ? (
        <View testID="endgame-review-gauge">
          <EvalBalanceBar value={whiteEval} testID="endgame-eval-balance" />
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            {t('quiz.ddEvalPerspective')}
          </Text>
        </View>
      ) : null}

      {diagnostic.status === 'uncertain' && (
        <Text style={{ color: colors.foreground }} testID="endgame-diagnostic-uncertain">
          {t('quiz.ddDiagnosticUncertain')}
        </Text>
      )}

      {diagnostic.status === 'ready' && (
        <View
          style={[styles.diagnostic, { borderColor: colors.border }]}
          testID="endgame-diagnostic"
        >
          <Text style={[styles.section, { color: colors.foreground }]}>
            {t('quiz.ddDecisiveMove')}
          </Text>
          <Text style={[styles.move, { color: colors.foreground }]} testID="endgame-decisive-move">
            {diagnostic.moveLabel}
          </Text>
          <Text style={[styles.section, { color: colors.foreground }]}>
            {t('quiz.ddBeforeMove')}
          </Text>
          <Text style={{ color: colors.foreground }} testID="endgame-eval-before">
            {evalText(diagnostic.before, missing)}
          </Text>
          <Text style={[styles.section, { color: colors.foreground }]}>
            {t('quiz.ddAfterMove')}
          </Text>
          <Text style={{ color: colors.foreground }} testID="endgame-eval-after">
            {evalText(diagnostic.after, missing)}
          </Text>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            {t('quiz.ddEvalPerspective')}
          </Text>
          <Text style={[styles.section, { color: colors.foreground }]}>
            {t('quiz.ddKeepDraw')}
          </Text>
          {diagnostic.alternatives.length === 0 ? (
            <Text style={{ color: colors.foreground }} testID="endgame-alternatives-empty">
              {t('quiz.ddNoAlternatives')}
            </Text>
          ) : (
            diagnostic.alternatives.map((san) => (
              <Text key={san} style={{ color: colors.foreground }} testID="endgame-alternative">
                {san}
              </Text>
            ))
          )}
          {diagnostic.partial ? (
            <Text style={[styles.note, { color: colors.mutedForeground }]} testID="endgame-alternatives-partial">
              {t('quiz.ddMoreAlternatives')}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Exposed for tests that format a lone eval the same way as the card. */
export function reviewEvalLabel(
  scoreCp: number | null | undefined,
  mateIn: number | null | undefined,
  missingLabel: string,
): string {
  return evalText(formatReviewEval(scoreCp, mateIn), missingLabel);
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: 6,
  },
  headline: {
    fontFamily: DesignTokens.typography.weightBold,
    fontSize: 22,
    lineHeight: 28,
  },
  secondary: {
    fontSize: 14,
  },
  section: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    marginTop: 8,
  },
  move: {
    fontSize: 18,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  note: {
    fontSize: 13,
  },
  diagnostic: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
});
