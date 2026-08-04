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
import { DesignTokens } from '@/constants/designTokens';
import {
  PIECE_COUNT_BANDS,
  PUZZLE_RATING_BANDS,
  emptyStreakState,
  type PuzzleStreakState,
} from '@/lib/puzzles';
import { formatStreakBandLabel } from '@/lib/puzzles/streakBand';
import type { MoveNamingRecords } from '@/lib/moveNaming/MoveNamingRecords';
import {
  RECORDS_CATEGORIES,
  type RecordsCategoryId,
  loadMoveNamingRecords,
  loadTacticsRecords,
  resetMoveNamingCategory,
  resetMoveNamingRecords,
  resetTacticsRecords,
} from '@/lib/records/AnyChessRecords';

function ratingLabel(id: string): string {
  return PUZZLE_RATING_BANDS.find((b) => b.id === id)?.label ?? id;
}

function pieceLabel(id: string): string {
  return PIECE_COUNT_BANDS.find((b) => b.id === id)?.label ?? id;
}

export default function RecordsHubScreen() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();

  const [category, setCategory] = useState<RecordsCategoryId>('tactics');
  const [tactics, setTactics] = useState<PuzzleStreakState>(emptyStreakState());
  const [moveNaming, setMoveNaming] = useState<MoveNamingRecords>({});

  const reload = useCallback(async () => {
    const [t, m] = await Promise.all([loadTacticsRecords(), loadMoveNamingRecords()]);
    setTactics(t);
    setMoveNaming(m);
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
      <Text style={[styles.title, { color: colors.foreground }]}>Records</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Tes meilleurs scores déjà enregistrés sur cet appareil
      </Text>

      <View style={styles.selector}>
        {RECORDS_CATEGORIES.map((cat) => {
          const active = category === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setCategory(cat.id)}
              testID={`records-cat-${cat.id}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? colors.primaryForeground : colors.foreground,
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 13,
                }}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.catDesc, { color: colors.mutedForeground }]}>
        {RECORDS_CATEGORIES.find((c) => c.id === category)?.description}
      </Text>

      {category === 'tactics' ? (
        <TacticsRecordsPanel
          snapshot={tactics}
          onReload={reload}
          colors={colors}
        />
      ) : (
        <MoveNamingRecordsPanel
          records={moveNaming}
          onReload={reload}
          colors={colors}
        />
      )}
    </ScrollView>
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
  const bandIds = Object.keys(snapshot.bestByBand)
    .filter((id) => (snapshot.bestByBand[id] ?? 0) > 0)
    .sort((a, b) => (snapshot.bestByBand[b] ?? 0) - (snapshot.bestByBand[a] ?? 0));

  const resetAll = () =>
    Alert.alert(
      'Réinitialiser les records ?',
      'Cette action effacera toutes les meilleures séries enregistrées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => resetTacticsRecords().then(onReload),
        },
      ],
    );

  return (
    <View style={styles.panel}>
      {bandIds.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>
          Aucun record pour l’instant — résous des problèmes pour en enregistrer.
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
          Réinitialiser les records tactiques
        </Text>
      </Pressable>
    </View>
  );
}

function MoveNamingRecordsPanel({
  records,
  onReload,
  colors,
}: {
  records: MoveNamingRecords;
  onReload: () => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const resetAll = () =>
    Alert.alert(
      'Réinitialiser tous les records ?',
      'Cette action supprimera tous les meilleurs scores enregistrés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => resetMoveNamingRecords().then(onReload),
        },
      ],
    );

  const resetOne = (seconds: number) =>
    Alert.alert(
      `Réinitialiser le record ${seconds} s ?`,
      `Le meilleur score pour ${seconds} seconde${seconds > 1 ? 's' : ''} par coup sera remis à zéro.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => resetMoveNamingCategory(seconds).then(onReload),
        },
      ],
    );

  return (
    <View style={styles.panel}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((seconds) => (
        <View
          key={seconds}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
            {seconds} s par coup
          </Text>
          <View style={styles.rowRight}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>
              {records[seconds] ?? 0}
            </Text>
            {(records[seconds] ?? 0) > 0 ? (
              <Pressable
                onPress={() => resetOne(seconds)}
                hitSlop={8}
                testID={`reset-hub-record-${seconds}`}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Réinit.</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      <Pressable onPress={resetAll} style={styles.resetBtn} testID="reset-hub-move-naming-records">
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
          Réinitialiser les scores
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
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: DesignTokens.minTouchTarget - 4,
    justifyContent: 'center',
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
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resetBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
});
