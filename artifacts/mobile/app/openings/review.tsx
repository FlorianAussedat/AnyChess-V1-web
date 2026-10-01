import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [poolOpen, setPoolOpen] = useState(false);

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
          {canTrain ? (
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
            </>
          ) : (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {t('openings.noActivePgn')}
            </Text>
          )}

          <Pressable
            onPress={() => setPoolOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: poolOpen }}
            style={({ pressed }) => [
              styles.disclosure,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            testID="review-pool-summary"
          >
            <Text style={[styles.disclosureText, { color: colors.foreground }]}>
              {t('openings.reviewPoolSummary', {
                files: entries.length,
                lines: lineCount,
              })}
            </Text>
            <Ionicons
              name={poolOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>

          {poolOpen ? (
            <View style={styles.poolList} testID="review-pool-list">
              {entries.length === 0 ? (
                <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                  {t('openings.noActivePgn')}
                </Text>
              ) : (
                <>
                  <Text style={[styles.listTitle, { color: colors.mutedForeground }]}>
                    {t('openings.activePgnList')}
                  </Text>
                  {entries.map((entry) => (
                    <View
                      key={entry.file.id}
                      style={[styles.pgnChip, { borderColor: colors.border, backgroundColor: colors.card }]}
                    >
                      <Text style={[styles.pgnName, { color: colors.foreground }]}>
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
            </View>
          ) : null}
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
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: DesignTokens.minTouchTarget,
    marginTop: 4,
  },
  disclosureText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  poolList: { gap: 8 },
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
  pgnName: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  pgnMeta: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  manageLink: { minHeight: DesignTokens.minTouchTarget, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  manageLabel: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
});
