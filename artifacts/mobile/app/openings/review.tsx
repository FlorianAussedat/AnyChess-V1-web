import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import {
  applyReviewPick,
  countReviewLines,
  listReviewPoolEntries,
  pickReviewLineFromMemory,
  pgnFileDisplayName,
  sideToPlayerColor,
} from '@/lib/repertoire';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HubModeCard } from '@/components/HubModeCard';
import { sideLabel } from '@/components/RepertoireSidePicker';
import { preferencesStore } from '@/lib/preferences';
import { getStrengthBand } from '@/lib/difficulty/StockfishStrengthBands';
import { DesignTokens } from '@/constants/designTokens';

export default function OpeningsReviewScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { ready, folders, getAllFiles } = useRepertoireLibrary();

  const entries = useMemo(
    () => listReviewPoolEntries(folders, getAllFiles()),
    [folders, getAllFiles],
  );
  const lineCount = countReviewLines(entries);
  const canTrain = entries.length > 0;

  const startPlay = useCallback(() => {
    const pick = pickReviewLineFromMemory(entries);
    if (!pick) return;
    applyReviewPick(pick, 'review');
    const color = sideToPlayerColor(pick.side);
    const band = getStrengthBand(
      preferencesStore.getPreferences().stockfishStrengthBandId || '',
    ).id;
    router.push(
      `/openings/play?folderId=${encodeURIComponent(pick.folder.id)}&fileId=${encodeURIComponent(pick.file.id)}&color=${color}&band=${encodeURIComponent(band)}&from=review` as Href,
    );
  }, [entries, router]);

  const startContinue = useCallback(() => {
    const pick = pickReviewLineFromMemory(entries);
    if (!pick) return;
    applyReviewPick(pick, 'review');
    router.push(
      `/openings/continue?folderId=${encodeURIComponent(pick.folder.id)}&fileId=${encodeURIComponent(pick.file.id)}&from=review` as Href,
    );
  }, [entries, router]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: contentTop,
          paddingBottom: contentBottom,
        },
      ]}
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={t('openings.review')}
        subtitle={t('openings.hubReviewHint')}
      />

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View
            style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}
            testID="review-pool-summary"
          >
            <Text style={[styles.summaryText, { color: colors.foreground }]}>
              {t('openings.reviewPoolSummary', {
                pgn: entries.length,
                lines: lineCount,
              })}
            </Text>
          </View>

          {!canTrain ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {t('openings.noActivePgn')}
            </Text>
          ) : (
            <>
              <HubModeCard
                title={t('openings.playVsRepertoire')}
                description={t('openings.playVsDesc')}
                iconName="game-controller-outline"
                onPress={startPlay}
                testID="review-play-btn"
              />
              <HubModeCard
                title={t('openings.continueLine')}
                description={t('openings.continueLineDesc')}
                iconName="git-branch-outline"
                onPress={startContinue}
                testID="review-continue-btn"
              />

              <Text style={[styles.listTitle, { color: colors.mutedForeground }]}>
                {t('openings.activePgnList')}
              </Text>
              {entries.map((entry) => (
                <View
                  key={entry.file.id}
                  style={[styles.pgnChip, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Text style={[styles.pgnName, { color: colors.foreground }]} numberOfLines={1}>
                    {pgnFileDisplayName(entry.file)}
                  </Text>
                  <Text style={[styles.pgnMeta, { color: colors.mutedForeground }]}>
                    {entry.folder.name}
                    {' · '}
                    {sideLabel(entry.side)}
                    {' · '}
                    {t('openings.linesShort', { count: entry.paths.length })}
                  </Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push('/openings/manage' as Href)}
        style={({ pressed }) => [
          styles.manageLink,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        testID="review-manage-link"
      >
        <Text style={[styles.manageLabel, { color: colors.primary }]}>
          {t('openings.managePgn')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  list: { gap: 12, paddingBottom: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  summaryText: { fontSize: 15, fontFamily: DesignTokens.typography.weightSemiBold },
  empty: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  listTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  pgnChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  pgnName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pgnMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  manageLink: { paddingVertical: 12, alignItems: 'center' },
  manageLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
