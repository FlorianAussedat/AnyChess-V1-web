/**
 * Menu — Entraînement aux Finales
 * Two entries: Nouvelles Finales! / Essaie encore!
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { HubModeCard } from '@/components/HubModeCard';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { BrandAssets } from '@/constants/BrandAssets';
import {
  loadEndgameStore,
  getTryAgainIds,
  pickNewPosition,
  pickTryAgainPosition,
  getFinishedIds,
  getVarietyContext,
  isRuntimePoolEmpty,
} from '@/lib/endgameTraining';
import { getSharedStockfishRuntime } from '@/lib/engines/runtime';

export default function EndgameTrainingMenuScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const poolEmpty = isRuntimePoolEmpty();
  const [tryAgainCount, setTryAgainCount] = useState(0);
  const [emptyTryAgain, setEmptyTryAgain] = useState(false);
  const [poolExhausted, setPoolExhausted] = useState(false);

  const refresh = useCallback(async () => {
    await loadEndgameStore();
    const ids = await getTryAgainIds();
    setTryAgainCount(ids.length);
    setEmptyTryAgain(false);
    setPoolExhausted(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const startTryAgain = async () => {
    const ids = await getTryAgainIds();
    if (ids.length === 0) {
      setEmptyTryAgain(true);
      return;
    }
    const pos = pickTryAgainPosition(ids);
    if (!pos) {
      setEmptyTryAgain(true);
      return;
    }
    router.push(
      `/puzzles/defends-nulle-play?positionId=${encodeURIComponent(pos.id)}&source=try-again` as Href,
    );
  };

  return (
    <ChessScreenScaffold
      title={t('quiz.defendsNullePageTitle')}
      subtitle={t('quiz.defendsNulleLead')}
      onBack={() => router.back()}
      testID="endgame-training-menu"
    >
      <HubModeCard
        title={t('quiz.endgameNewFinales')}
        description={t('quiz.endgameNewFinalesDesc')}
        icon={BrandAssets.exercises.defendsNulle}
        onPress={() => void startNew()}
        disabled={poolEmpty}
        testID="endgame-card-new"
      />
      <HubModeCard
        title={t('quiz.endgameTryAgain')}
        description={t('quiz.endgameTryAgainDesc')}
        icon={BrandAssets.exercises.defendsNulle}
        onPress={() => void startTryAgain()}
        disabled={tryAgainCount === 0}
        testID="endgame-card-try-again"
      />

      {poolEmpty && (
        <View style={styles.emptyBox} testID="endgame-pool-preparing">
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {t('quiz.endgamePoolPreparing')}
          </Text>
        </View>
      )}

      {emptyTryAgain && (
        <View style={styles.emptyBox} testID="endgame-try-again-empty">
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {t('quiz.endgameTryAgainEmpty')}
          </Text>
        </View>
      )}

      {poolExhausted && !poolEmpty && (
        <View style={styles.emptyBox} testID="endgame-pool-exhausted">
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {t('quiz.endgamePoolExhausted')}
          </Text>
          {tryAgainCount > 0 && (
            <AppButton
              label={t('quiz.endgameTryAgain')}
              onPress={() => void startTryAgain()}
            />
          )}
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
