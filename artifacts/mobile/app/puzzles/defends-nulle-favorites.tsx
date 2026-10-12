/**
 * Starred initial positions for « Défends la nulle ».
 * Independent of the ten-attempt history.
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
  listDefendDrawFavorites,
  unstarDefendDrawPosition,
  type DefendDrawFavorite,
} from '@/lib/endgameTraining';

export default function DefendDrawFavoritesScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [favorites, setFavorites] = useState<DefendDrawFavorite[]>([]);

  const refresh = useCallback(async () => {
    setFavorites(await listDefendDrawFavorites());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const open = (favorite: DefendDrawFavorite) => {
    router.push(
      `/puzzles/defends-nulle-play?positionId=${encodeURIComponent(favorite.positionId)}&source=favorite` as Href,
    );
  };

  const askRemove = (favorite: DefendDrawFavorite) => {
    presentAppDialog({
      title: t('quiz.ddUnstarTitle'),
      message: '',
      cancelLabel: t('common.cancel'),
      confirmLabel: t('quiz.ddUnstarConfirm'),
      variant: 'destructive',
      onConfirm: () => {
        void unstarDefendDrawPosition({
          positionId: favorite.positionId,
          playerColor: favorite.playerColor,
          initialFen: favorite.initialFen,
        }).then(refresh);
      },
    });
  };

  return (
    <ChessScreenScaffold
      title={t('quiz.ddReviewFinales')}
      onBack={() => router.back()}
      testID="endgame-favorites"
    >
      {favorites.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} testID="endgame-favorites-empty">
          {t('quiz.ddFavoritesEmpty')}
        </Text>
      ) : (
        favorites.map((favorite) => (
          <View
            key={favorite.id}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            testID="endgame-favorite-row"
          >
            <Pressable onPress={() => open(favorite)} style={styles.labelPress}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {favorite.playerColor === 'white'
                  ? t('quiz.ddDefendWithWhite')
                  : t('quiz.ddDefendWithBlack')}
              </Text>
            </Pressable>
            <DefendDrawStarButton starred onPress={() => askRemove(favorite)} testID="endgame-favorite-star" />
          </View>
        ))
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
  labelPress: { flex: 1 },
  label: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 16,
  },
});
