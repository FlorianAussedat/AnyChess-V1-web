/**
 * Last ten « Défends la nulle » attempts, newest first.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { DefendDrawStarButton } from '@/components/exercise/DefendDrawStarButton';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { presentAppDialog } from '@/lib/ui/appDialogStore';
import {
  attemptFromHistory,
  isDefendDrawStarred,
  listDefendDrawHistory,
  reviewHeadlineKey,
  starDefendDrawPosition,
  unstarDefendDrawPosition,
  type DefendDrawHistoryAttempt,
} from '@/lib/endgameTraining';

export default function DefendDrawHistoryScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [rows, setRows] = useState<Array<DefendDrawHistoryAttempt & { starred: boolean }>>([]);

  const refresh = useCallback(async () => {
    const history = await listDefendDrawHistory();
    const withStars = await Promise.all(
      history.map(async (row) => ({
        ...row,
        starred: await isDefendDrawStarred(row.positionId, row.playerColor, row.initialFen),
      })),
    );
    setRows(withStars);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const open = (row: DefendDrawHistoryAttempt) => {
    router.push(
      `/puzzles/defends-nulle-play?positionId=${encodeURIComponent(row.positionId)}&source=history&reviewAttempt=${encodeURIComponent(row.id)}` as Href,
    );
  };

  const toggleStar = (row: DefendDrawHistoryAttempt & { starred: boolean }) => {
    if (row.starred) {
      presentAppDialog({
        title: t('quiz.ddUnstarTitle'),
        message: '',
        cancelLabel: t('common.cancel'),
        confirmLabel: t('quiz.ddUnstarConfirm'),
        variant: 'destructive',
        onConfirm: () => {
          void unstarDefendDrawPosition({
            positionId: row.positionId,
            playerColor: row.playerColor,
            initialFen: row.initialFen,
          }).then(refresh);
        },
      });
      return;
    }
    void starDefendDrawPosition({
      positionId: row.positionId,
      playerColor: row.playerColor,
      initialFen: row.initialFen,
    }).then(refresh);
  };

  return (
    <ChessScreenScaffold
      title={t('quiz.ddHistory')}
      testID="endgame-history"
    >
      {rows.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} testID="endgame-history-empty">
          {t('quiz.ddHistoryEmpty')}
        </Text>
      ) : (
        rows.map((row) => {
          const attempt = attemptFromHistory(row);
          const headline = t(
            reviewHeadlineKey({
              outcome: attempt.outcome,
              officialDrawReason: attempt.officialDrawReason,
              checkmateWinner: attempt.checkmateWinner,
              playerColor: row.playerColor,
            }),
          );
          const when = row.finishedAt ? row.finishedAt.slice(0, 10) : '';
          return (
            <View
              key={row.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              testID="endgame-history-row"
            >
              <Pressable onPress={() => open(row)} style={styles.text}>
                <Text style={[styles.headline, { color: colors.foreground }]}>{headline}</Text>
                <Text style={{ color: colors.mutedForeground }}>
                  {t('quiz.endgameMovesResisted', { count: row.movesResisted })}
                  {when ? ` · ${when}` : ''}
                </Text>
              </Pressable>
              <DefendDrawStarButton
                starred={row.starred}
                onPress={() => toggleStar(row)}
                testID="endgame-history-star"
              />
            </View>
          );
        })
      )}
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingHorizontal: DesignTokens.spacing.md,
    paddingVertical: 14,
  },
  text: { flex: 1, gap: 2 },
  headline: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 16,
  },
});
