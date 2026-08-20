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
  getTryAgainIds,
  pickNewPosition,
  pickTryAgainPosition,
  getFinishedIds,
  getVarietyContext,
} from '@/lib/endgameTraining';

export default function EndgameTrainingMenuScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [tryAgainCount, setTryAgainCount] = useState(0);
  const [emptyTryAgain, setEmptyTryAgain] = useState(false);
  const [poolExhausted, setPoolExhausted] = useState(false);

  const refresh = useCallback(async () => {
    const ids = await getTryAgainIds();
    setTryAgainCount(ids.length);
    setEmptyTryAgain(false);
    setPoolExhausted(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startNew = async () => {
    const finished = await getFinishedIds();
    const variety = await getVarietyContext();
    const pos = pickNewPosition(finished, variety.recentFamilies, variety.recentSignatures);
    if (!pos) {
      setPoolExhausted(true);
      return;
    }
    router.push({
      pathname: '/puzzles/defends-nulle-play',
      params: { positionId: pos.id, source: 'new' },
    } as Href);
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
    router.push({
      pathname: '/puzzles/defends-nulle-play',
      params: { positionId: pos.id, source: 'try-again' },
    } as Href);
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
        testID="endgame-card-new"
      />
      <HubModeCard
        title={t('quiz.endgameTryAgain')}
        description={t('quiz.endgameTryAgainDesc')}
        icon={BrandAssets.exercises.defendsNulle}
        onPress={() => void startTryAgain()}
        testID="endgame-card-try-again"
      />

      {emptyTryAgain && (
        <View style={styles.emptyBox} testID="endgame-try-again-empty">
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {t('quiz.endgameTryAgainEmpty')}
          </Text>
        </View>
      )}

      {poolExhausted && (
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
