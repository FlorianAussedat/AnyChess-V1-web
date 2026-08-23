/**
 * Catalogue — Finales théoriques (canonical carousel + list).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { AppButton } from '@/components/ui/AppButton';
import { TheoreticalMiniDiagram } from '@/components/theoretical/TheoreticalMiniDiagram';
import { TheoreticalExplanationOverlay } from '@/components/theoretical/TheoreticalExplanationOverlay';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  THEORETICAL_THEMES,
  getCatalogView,
  setCatalogView,
  getAllThemeScores,
  pickRandomFromActiveThemes,
  getLastPositionId,
  pickPositionInTheme,
  getThemeAttempts,
  listByTheme,
  formatComprehensionScore,
  isThemeMastered,
  type CatalogViewMode,
  type TheoreticalThemeId,
  type TheoreticalEndgamePosition,
} from '@/lib/theoreticalEndgame';
import { getSharedStockfishRuntime } from '@/lib/engines/runtime';
import type { MessageKey } from '@/lib/i18n';

function themeTitleKey(id: string): MessageKey {
  const theme = THEORETICAL_THEMES.find((t) => t.id === id);
  return `quiz.theoreticalTheme${theme?.titleKey ?? 'QueenMate'}` as MessageKey;
}

type ThemeCardModel = {
  theme: (typeof THEORETICAL_THEMES)[number];
  position: TheoreticalEndgamePosition;
};

export default function TheoreticalEndgameCatalogScreen() {
  const colors = useColors();
  const { t, language } = useTranslation();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewMode, setViewMode] = useState<CatalogViewMode>('cards');
  const [scores, setScores] = useState<Record<string, { score: number; count: number }>>({});
  const [allMasteredMsg, setAllMasteredMsg] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [explanationThemeId, setExplanationThemeId] = useState<TheoreticalThemeId | null>(null);
  const listRef = useRef<FlatList<ThemeCardModel>>(null);
  const restoreIndexRef = useRef(0);

  const cards = useMemo<ThemeCardModel[]>(() => {
    return THEORETICAL_THEMES.map((theme) => {
      const positions = listByTheme(theme.id);
      return { theme, position: positions[0]! };
    }).filter((c) => !!c.position);
  }, []);

  const cardWidth = Math.round(windowWidth * 0.84);
  const cardGap = 12;
  const snapInterval = cardWidth + cardGap;
  const sidePad = Math.max(0, (windowWidth - cardWidth) / 2);
  const diagramSize = Math.min(cardWidth - 48, Math.round(windowHeight * 0.34), 280);
  const listDiagramSize = 72;

  const refresh = useCallback(async () => {
    setViewMode(await getCatalogView());
    setScores(await getAllThemeScores());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const idx = restoreIndexRef.current;
      if (viewMode === 'cards' && listRef.current && cards.length > 0) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({
            offset: idx * snapInterval,
            animated: false,
          });
          setCarouselIndex(idx);
        });
      }
    }, [refresh, viewMode, cards.length, snapInterval]),
  );

  useEffect(() => {
    getSharedStockfishRuntime().prewarm();
  }, []);

  const toggleView = async () => {
    const next = viewMode === 'cards' ? 'list' : 'cards';
    setViewMode(next);
    await setCatalogView(next);
  };

  const launch = (positionId: string, themeId: string) => {
    restoreIndexRef.current = carouselIndex;
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
    const pick = pickRandomFromActiveThemes(themeAttempts, null);
    if (!pick) return;
    setAllMasteredMsg(pick.allMastered);
    const idx = cards.findIndex((c) => c.theme.id === pick.position.themeId);
    if (idx >= 0) {
      restoreIndexRef.current = idx;
      setCarouselIndex(idx);
    }
    launch(pick.position.id, pick.position.themeId);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / snapInterval);
    const clamped = Math.max(0, Math.min(cards.length - 1, idx));
    setCarouselIndex(clamped);
    restoreIndexRef.current = clamped;
  };

  const explanationCard = explanationThemeId
    ? cards.find((c) => c.theme.id === explanationThemeId) ?? null
    : null;

    const locale = language === 'en' ? 'en' : 'fr';

  const renderCard = ({ item }: { item: ThemeCardModel }) => {
    const sc = scores[item.theme.id] ?? { score: 0, count: 0 };
    const mastered = isThemeMastered(sc.score);
    const title = t(themeTitleKey(item.theme.id));
    const scoreLabel =
      sc.count > 0 ? formatComprehensionScore(sc.score) : t('quiz.theoreticalNoAttempts');

    return (
      <View
        style={[
          styles.card,
          {
            width: cardWidth,
            backgroundColor: colors.card,
            borderColor: colors.border,
            marginRight: cardGap,
          },
        ]}
        testID={`theoretical-theme-card-${item.theme.id}`}
      >
        <Pressable
          style={styles.cardBody}
          onPress={() => void startTheme(item.theme.id)}
          testID={`theoretical-theme-launch-${item.theme.id}`}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {title}
          </Text>
          <TheoreticalMiniDiagram
            fen={item.position.initialFen}
            size={diagramSize}
            flipped={item.position.diagramOrientation === 'black'}
            testID={`theoretical-theme-diagram-${item.theme.id}`}
          />
          <Text
            style={[styles.score, { color: mastered ? '#398a55' : colors.mutedForeground }]}
            testID={`theoretical-theme-score-${item.theme.id}`}
          >
            {scoreLabel}
            {mastered ? ` · ${t('quiz.theoreticalCompleted')}` : ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setExplanationThemeId(item.theme.id)}
          hitSlop={8}
          testID={`theoretical-theme-explain-${item.theme.id}`}
        >
          <Text style={{ color: colors.primary, textAlign: 'center', fontSize: 14 }}>
            {t('quiz.theoreticalExplainLink')}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderListRow = ({ item }: { item: ThemeCardModel }) => {
    const sc = scores[item.theme.id] ?? { score: 0, count: 0 };
    const mastered = isThemeMastered(sc.score);
    const title = t(themeTitleKey(item.theme.id));
    const scoreLabel =
      sc.count > 0 ? formatComprehensionScore(sc.score) : t('quiz.theoreticalNoAttempts');

    return (
      <View
        style={[styles.listRow, { borderColor: colors.border, backgroundColor: colors.card }]}
        testID={`theoretical-theme-list-${item.theme.id}`}
      >
        <Pressable
          style={styles.listMain}
          onPress={() => void startTheme(item.theme.id)}
          testID={`theoretical-theme-list-launch-${item.theme.id}`}
        >
          <TheoreticalMiniDiagram
            fen={item.position.initialFen}
            size={listDiagramSize}
            flipped={item.position.diagramOrientation === 'black'}
          />
          <View style={styles.listTextCol}>
            <Text style={[styles.listTitle, { color: colors.foreground }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{scoreLabel}</Text>
            {mastered && (
              <Text style={{ color: '#398a55', fontSize: 12 }}>{t('quiz.theoreticalCompleted')}</Text>
            )}
          </View>
        </Pressable>
        <Pressable
          onPress={() => setExplanationThemeId(item.theme.id)}
          hitSlop={8}
          testID={`theoretical-theme-list-explain-${item.theme.id}`}
        >
          <Text style={{ color: colors.primary, fontSize: 13 }}>
            {t('quiz.theoreticalExplainLink')}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <ChessScreenScaffold
        title={t('quiz.theoreticalEndgameTitle')}
        onBack={() => {
          if (explanationThemeId) {
            setExplanationThemeId(null);
            return;
          }
          router.back();
        }}
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
          <FlatList
            ref={listRef}
            data={cards}
            keyExtractor={(item) => item.theme.id}
            renderItem={renderCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            decelerationRate="fast"
            disableIntervalMomentum
            getItemLayout={(_, index) => ({
              length: snapInterval,
              offset: snapInterval * index,
              index,
            })}
            contentContainerStyle={{ paddingHorizontal: sidePad, paddingVertical: 8 }}
            onMomentumScrollEnd={onMomentumEnd}
            testID="theoretical-theme-carousel"
            style={styles.carousel}
          />
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(item) => item.theme.id}
            renderItem={renderListRow}
            contentContainerStyle={styles.listContent}
            testID="theoretical-theme-list"
          />
        )}
      </ChessScreenScaffold>

      {explanationCard && (
        <TheoreticalExplanationOverlay
          visible={!!explanationThemeId}
          title={t(themeTitleKey(explanationCard.theme.id))}
          explanation={explanationCard.position.explanation}
          locale={locale}
          onClose={() => setExplanationThemeId(null)}
          onPlay={() => {
            const themeId = explanationCard.theme.id;
            setExplanationThemeId(null);
            void startTheme(themeId);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
    marginBottom: DesignTokens.spacing.sm,
  },
  carousel: { flexGrow: 1 },
  card: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.md,
    gap: DesignTokens.spacing.md,
    justifyContent: 'space-between',
    minHeight: 420,
  },
  cardBody: {
    flex: 1,
    gap: DesignTokens.spacing.md,
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 18,
    textAlign: 'center',
  },
  score: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  listContent: { gap: DesignTokens.spacing.sm, paddingBottom: DesignTokens.spacing.xl },
  listRow: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: DesignTokens.spacing.sm,
  },
  listMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
  },
  listTextCol: { flex: 1, gap: 2 },
  listTitle: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 15,
  },
});
