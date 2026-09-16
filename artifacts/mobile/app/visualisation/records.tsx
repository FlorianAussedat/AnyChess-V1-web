import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';
import { defaultKeyValueStorage } from '@/lib/storage';
import { MoveNamingRecordsStore } from '@/lib/moveNaming/MoveNamingRecords';
import { PlayMoveRecordsStore } from '@/lib/playMove/PlayMoveRecords';

const moveNamingStore = new MoveNamingRecordsStore(defaultKeyValueStorage);
const playMoveStore = new PlayMoveRecordsStore(defaultKeyValueStorage);

export default function VisualisationRecordsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const [moveNamingBest, setMoveNamingBest] = useState(0);
  const [playMoveBest, setPlayMoveBest] = useState(0);
  const [legacy, setLegacy] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    const [mn, pm, leg] = await Promise.all([
      moveNamingStore.loadBest().catch(() => 0),
      playMoveStore.loadBest().catch(() => 0),
      moveNamingStore.load().catch(() => ({}) as Record<number, number>),
    ]);
    setMoveNamingBest(mn);
    setPlayMoveBest(pm);
    setLegacy(leg);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasLegacy = Object.values(legacy).some((v) => (v ?? 0) > 0);

  const resetAll = () =>
    Alert.alert(
      t('records.visionResetTitle'),
      t('records.visionResetBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: () =>
            Promise.all([moveNamingStore.reset(), playMoveStore.reset()]).then(load),
        },
      ],
    );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.page,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + DesignTokens.spacing.md,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
    >
      <ScreenHeader onBack={() => router.back()} title={t('records.title')} />
      <Text style={{ color: colors.mutedForeground }}>
        {t('records.visionSubtitle')}
      </Text>

      <View style={[styles.row, { borderColor: colors.border }]} testID="record-move-naming-60">
        <Text style={{ color: colors.foreground, flex: 1 }}>{t('records.cat.naming')}</Text>
        <Text style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightBold }}>
          {moveNamingBest}
        </Text>
      </View>
      <View style={[styles.row, { borderColor: colors.border }]} testID="record-play-move-60">
        <Text style={{ color: colors.foreground, flex: 1 }}>{t('records.cat.play')}</Text>
        <Text style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightBold }}>
          {playMoveBest}
        </Text>
      </View>

      {hasLegacy ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {t('records.legacyNote')}
        </Text>
      ) : null}

      <AppButton label={t('common.reset')} variant="destructive" onPress={resetAll} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.xl,
    gap: DesignTokens.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    padding: DesignTokens.spacing.md,
    gap: DesignTokens.spacing.sm,
  },
});
