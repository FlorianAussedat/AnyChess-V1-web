/**
 * Centralized Records hub — selector over real persisted record stores only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { OptionChip } from '@/components/ui/OptionChip';
import {
  PIECE_COUNT_BANDS,
  PUZZLE_RATING_BANDS,
  emptyStreakState,
  type PuzzleStreakState,
} from '@/lib/puzzles';
import { formatStreakBandLabel } from '@/lib/puzzles/streakBand';
import {
  RECORDS_CATEGORIES,
  type RecordsCategoryId,
  type BlindMemoryRecords,
  loadMoveNamingBest,
  loadPlayMoveBest,
  loadTacticsRecords,
  loadBlindMemoryRecords,
  resetMoveNamingRecords,
  resetPlayMoveRecords,
  resetTacticsRecords,
  resetBlindMemoryRecords,
} from '@/lib/records/AnyChessRecords';

function ratingLabel(id: string): string {
  return PUZZLE_RATING_BANDS.find((b) => b.id === id)?.label ?? id;
}

function pieceLabel(id: string): string {
  return PIECE_COUNT_BANDS.find((b) => b.id === id)?.label ?? id;
}

export default function RecordsHubScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();

  const [category, setCategory] = useState<RecordsCategoryId>('tactics');
  const [tactics, setTactics] = useState<PuzzleStreakState>(emptyStreakState());
  const [moveNamingBest, setMoveNamingBest] = useState(0);
  const [playMoveBest, setPlayMoveBest] = useState(0);
  const [blindRecords, setBlindRecords] = useState<BlindMemoryRecords>({
    listenReconstruct: 0,
    watchRecite: 0,
  });

  const reload = useCallback(async () => {
    const [tacticsSnap, mn, pm, br] = await Promise.all([
      loadTacticsRecords(),
      loadMoveNamingBest(),
      loadPlayMoveBest(),
      loadBlindMemoryRecords(),
    ]);
    setTactics(tacticsSnap);
    setMoveNamingBest(mn);
    setPlayMoveBest(pm);
    setBlindRecords(br);
  }, []);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: topPad + DesignTokens.spacing.xl,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
      testID="records-screen"
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{t('records.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {t('records.subtitle')}
      </Text>

      <View style={styles.selector} testID="records-category-selector">
        {RECORDS_CATEGORIES.map((cat) => (
          <View key={cat.id} testID={`records-cat-${cat.id}`}>
            <OptionChip
              label={t(cat.labelKey)}
              active={category === cat.id}
              onPress={() => setCategory(cat.id)}
            />
          </View>
        ))}
      </View>

      <Text style={[styles.catDesc, { color: colors.mutedForeground }]}>
        {(() => {
          const key = RECORDS_CATEGORIES.find((c) => c.id === category)?.descriptionKey;
          return key ? t(key) : '';
        })()}
      </Text>

      {category === 'tactics' ? (
        <TacticsRecordsPanel snapshot={tactics} onReload={reload} colors={colors} />
      ) : category === 'play-move' ? (
        <Session60RecordsPanel
          label={t('records.cat.play')}
          best={playMoveBest}
          onReset={() => resetPlayMoveRecords().then(reload)}
          resetTestID="reset-hub-play-move-records"
          colors={colors}
        />
      ) : category === 'memorisation' ? (
        <MemorisationRecordsPanel
          records={blindRecords}
          onReset={() => resetBlindMemoryRecords().then(reload)}
          colors={colors}
        />
      ) : (
        <Session60RecordsPanel
          label={t('records.cat.naming')}
          best={moveNamingBest}
          onReset={() => resetMoveNamingRecords().then(reload)}
          resetTestID="reset-hub-move-naming-records"
          colors={colors}
        />
      )}
    </ScrollView>
  );
}

function MemorisationRecordsPanel({
  records,
  onReset,
  colors,
}: {
  records: BlindMemoryRecords;
  onReset: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const resetAll = () =>
    Alert.alert(
      t('records.resetTitle'),
      t('records.blindResetBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: onReset,
        },
      ],
    );

  const rows: { label: string; value: number; testID: string }[] = [
    {
      label: t('blind.listenReconstruct'),
      value: records.listenReconstruct,
      testID: 'records-blind-listen',
    },
    {
      label: t('blind.watchRecite'),
      value: records.watchRecite,
      testID: 'records-blind-watch',
    },
  ];

  return (
    <View style={styles.panel}>
      {rows.map((row) => (
        <View
          key={row.testID}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
          testID={row.testID}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 1 }}>
            {row.label}
          </Text>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 20 }}>
            {row.value}
          </Text>
        </View>
      ))}
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
        {t('records.blindHint')}
      </Text>
      <Pressable onPress={resetAll} style={styles.resetBtn} testID="reset-hub-blind-records">
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
          {t('common.reset')}
        </Text>
      </Pressable>
    </View>
  );
}

function TacticsRecordsPanel({
  snapshot,
  onReload,
  colors,
}: {
  snapshot: PuzzleStreakState;
  onReload: () => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const bandIds = Object.keys(snapshot.bestByBand)
    .filter((id) => (snapshot.bestByBand[id] ?? 0) > 0)
    .sort((a, b) => (snapshot.bestByBand[b] ?? 0) - (snapshot.bestByBand[a] ?? 0));

  const resetAll = () =>
    Alert.alert(
      t('records.resetTitle'),
      t('records.tacticsResetBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: () => resetTacticsRecords().then(onReload),
        },
      ],
    );

  return (
    <View style={styles.panel}>
      {bandIds.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>
          {t('records.emptyTactics')}
        </Text>
      ) : (
        bandIds.map((bandId) => (
          <View
            key={bandId}
            style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 1 }}>
              {formatStreakBandLabel(bandId, ratingLabel, pieceLabel)}
            </Text>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>
              {snapshot.bestByBand[bandId] ?? 0}
            </Text>
          </View>
        ))
      )}
      <Pressable onPress={resetAll} style={styles.resetBtn} testID="reset-hub-tactics-records">
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
          {t('records.resetTactics')}
        </Text>
      </Pressable>
    </View>
  );
}

function Session60RecordsPanel({
  label,
  best,
  onReset,
  resetTestID,
  colors,
}: {
  label: string;
  best: number;
  onReset: () => void;
  resetTestID: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const resetAll = () =>
    Alert.alert(
      t('records.sessionResetTitle'),
      t('records.sessionResetBody', { label }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: onReset,
        },
      ],
    );

  return (
    <View style={styles.panel}>
      <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 1 }}>
          {t('records.best60')}
        </Text>
        <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 22 }}>
          {best}
        </Text>
      </View>
      <Pressable onPress={resetAll} style={styles.resetBtn} testID={resetTestID}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
          {t('common.reset')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: DesignTokens.spacing.md,
  },
  title: {
    fontSize: DesignTokens.typography.title,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  selector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catDesc: {
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  panel: { gap: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 13,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    gap: 10,
  },
  resetBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
});
