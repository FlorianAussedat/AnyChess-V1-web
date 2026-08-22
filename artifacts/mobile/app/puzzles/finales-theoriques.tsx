/**
 * Catalogue — Finales théoriques
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { HubModeCard } from '@/components/HubModeCard';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { BrandAssets } from '@/constants/BrandAssets';
import {
  THEORETICAL_THEMES,
  getCatalogView,
  setCatalogView,
  getAllThemeScores,
  pickRandomFromActiveThemes,
  getLastPositionId,
  pickPositionInTheme,
  getThemeAttempts,
  formatComprehensionScore,
  isThemeMastered,
  type CatalogViewMode,
  type TheoreticalThemeId,
} from '@/lib/theoreticalEndgame';

const ICON_MAP = {
  defendsNulle: BrandAssets.exercises.defendsNulle,
  construisOuverture: BrandAssets.exercises.construisOuverture,
  jouerLeCoup: BrandAssets.exercises.jouerLeCoup,
} as const;

import type { MessageKey } from '@/lib/i18n';

function themeTitleKey(id: string): MessageKey {
  const theme = THEORETICAL_THEMES.find((t) => t.id === id);
  return `quiz.theoreticalTheme${theme?.titleKey ?? 'QueenMate'}` as MessageKey;
}

export default function TheoreticalEndgameCatalogScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<CatalogViewMode>('cards');
  const [scores, setScores] = useState<Record<string, { score: number; count: number }>>({});
  const [allMasteredMsg, setAllMasteredMsg] = useState(false);

  const refresh = useCallback(async () => {
    setViewMode(await getCatalogView());
    setScores(await getAllThemeScores());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleView = async () => {
    const next = viewMode === 'cards' ? 'list' : 'cards';
    setViewMode(next);
    await setCatalogView(next);
  };

  const launch = (positionId: string, themeId: string) => {
    router.push(
      `/puzzles/finales-theoriques-play?positionId=${encodeURIComponent(positionId)}&themeId=${encodeURIComponent(themeId)}` as Href,
    );
  };

  const startTheme = async (themeId: TheoreticalThemeId) => {
    const last = await getLastPositionId(themeId);
    const pos = pickPositionInTheme(themeId, last);
    if (pos) launch(pos.id, themeId);
  };

  const startRandom = async () => {
    const themeAttempts: Record<string, { attempts: Awaited<ReturnType<typeof getThemeAttempts>> }> = {};
    for (const th of THEORETICAL_THEMES) {
      themeAttempts[th.id] = { attempts: await getThemeAttempts(th.id) };
    }
    const lastGlobal = null;
    const pick = pickRandomFromActiveThemes(themeAttempts, lastGlobal);
    if (!pick) return;
    setAllMasteredMsg(pick.allMastered);
    launch(pick.position.id, pick.position.themeId);
  };

  const renderTheme = (theme: (typeof THEORETICAL_THEMES)[number]) => {
    const sc = scores[theme.id] ?? { score: 0, count: 0 };
    const mastered = isThemeMastered(sc.score);
    const title = t(themeTitleKey(theme.id));
    const scoreLabel =
      sc.count > 0
        ? formatComprehensionScore(sc.score)
        : t('quiz.theoreticalNoAttempts');

    if (viewMode === 'list') {
      return (
        <Pressable
          key={theme.id}
          onPress={() => void startTheme(theme.id)}
          style={[styles.listRow, { borderColor: colors.border, backgroundColor: colors.card }]}
          testID={`theoretical-theme-list-${theme.id}`}
        >
          <Text style={[styles.listTitle, { color: colors.foreground }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{scoreLabel}</Text>
          {mastered && (
            <Text style={{ color: '#398a55', fontSize: 12 }}>{t('quiz.theoreticalCompleted')}</Text>
          )}
        </Pressable>
      );
    }

    return (
      <View key={theme.id} style={styles.cardWrap}>
        <HubModeCard
          title={title}
          description={scoreLabel + (mastered ? ` · ${t('quiz.theoreticalCompleted')}` : '')}
          icon={ICON_MAP[theme.iconKey]}
          onPress={() => void startTheme(theme.id)}
          testID={`theoretical-theme-card-${theme.id}`}
        />
      </View>
    );
  };

  return (
    <ChessScreenScaffold
      title={t('quiz.theoreticalEndgameTitle')}
      subtitle={t('quiz.theoreticalEndgameLead')}
      onBack={() => router.back()}
      testID="theoretical-endgame-catalog"
    >
      <View style={styles.toolbar}>
        <AppButton
          label={t('quiz.theoreticalRandom')}
          onPress={() => void startRandom()}
          testID="theoretical-random"
        />
        <Pressable onPress={() => void toggleView()} hitSlop={8} testID="theoretical-view-toggle">
          <Text style={{ color: colors.primary, fontSize: 13 }}>
            {viewMode === 'cards'
              ? t('quiz.theoreticalViewList')
              : t('quiz.theoreticalViewCards')}
          </Text>
        </Pressable>
      </View>

      {allMasteredMsg && (
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          {t('quiz.theoreticalAllMastered')}
        </Text>
      )}

      {viewMode === 'cards' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          testID="theoretical-theme-carousel"
        >
          {THEORETICAL_THEMES.map(renderTheme)}
        </ScrollView>
      ) : (
        <FlatList
          data={[...THEORETICAL_THEMES]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderTheme(item)}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      )}
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
  carousel: {
    gap: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.sm,
    paddingRight: DesignTokens.spacing.md,
  },
  cardWrap: { width: 280 },
  listContent: { gap: DesignTokens.spacing.sm },
  listRow: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: 4,
  },
  listTitle: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 15,
  },
});
