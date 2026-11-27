/**
 * Menu — Défends la nulle.
 * Three entries: Nouvelle finale, Finales à revoir, Historique.
 */
import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { HubModeCard } from '@/components/HubModeCard';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  getFinishedIds,
  getVarietyContext,
  isRuntimePoolEmpty,
  pickNewPosition,
} from '@/lib/endgameTraining';
import { getSharedStockfishRuntime } from '@/lib/engines/runtime';

export default function EndgameTrainingMenuScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const poolEmpty = isRuntimePoolEmpty();
  const [poolExhausted, setPoolExhausted] = useState(false);

  useEffect(() => {
    getSharedStockfishRuntime().prewarm();
  }, []);

  const startNew = async () => {
    if (poolEmpty) return;
    const finished = await getFinishedIds();
    const variety = await getVarietyContext();
    const pos = pickNewPosition(finished, variety.recentFamilies, variety.recentSignatures);
    if (!pos) {
      setPoolExhausted(true);
      return;
    }
    router.push(
      `/puzzles/defends-nulle-play?positionId=${encodeURIComponent(pos.id)}&source=new` as Href,
    );
  };

  return (
    <ChessScreenScaffold
      title={t('quiz.defendsNullePageTitle')}
      testID="endgame-training-menu"
    >
      <HubModeCard
        title={t('quiz.ddNewFinale')}
        onPress={() => void startNew()}
        disabled={poolEmpty}
        testID="endgame-card-new"
      />
      <HubModeCard
        title={t('quiz.ddReviewFinales')}
        onPress={() => router.push('/puzzles/defends-nulle-favorites' as Href)}
        testID="endgame-card-review"
      />
      <HubModeCard
        title={t('quiz.ddHistory')}
        onPress={() => router.push('/puzzles/defends-nulle-history' as Href)}
        testID="endgame-card-history"
      />

      {poolEmpty && (
        <View style={styles.emptyBox} testID="endgame-pool-preparing">
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {t('quiz.endgamePoolPreparing')}
          </Text>
        </View>
      )}

      {poolExhausted && !poolEmpty && (
        <View style={styles.emptyBox} testID="endgame-pool-exhausted">
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {t('quiz.endgamePoolExhausted')}
          </Text>
        </View>
      )}
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    marginTop: DesignTokens.spacing.md,
    gap: DesignTokens.spacing.sm,
  },
});
