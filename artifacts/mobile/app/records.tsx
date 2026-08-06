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
  loadMoveNamingBest,
  loadPlayMoveBest,
  loadTacticsRecords,
  resetMoveNamingRecords,
  resetPlayMoveRecords,
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
  const [moveNamingBest, setMoveNamingBest] = useState(0);
  const [playMoveBest, setPlayMoveBest] = useState(0);

  const reload = useCallback(async () => {
    const [t, mn, pm] = await Promise.all([
      loadTacticsRecords(),
      loadMoveNamingBest(),
      loadPlayMoveBest(),
    ]);
    setTactics(t);
    setMoveNamingBest(mn);
    setPlayMoveBest(pm);
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

      <View style={styles.selector} testID="records-category-selector">
        {RECORDS_CATEGORIES.map((cat) => (
          <View key={cat.id} testID={`records-cat-${cat.id}`}>
            <OptionChip
              label={cat.label}
              active={category === cat.id}
              onPress={() => setCategory(cat.id)}
            />
          </View>
        ))}
      </View>

      <Text style={[styles.catDesc, { color: colors.mutedForeground }]}>
        {RECORDS_CATEGORIES.find((c) => c.id === category)?.description}
      </Text>

      {category === 'tactics' ? (
        <TacticsRecordsPanel snapshot={tactics} onReload={reload} colors={colors} />
      ) : category === 'play-move' ? (
        <Session60RecordsPanel
          label="Jouer le coup"
          best={playMoveBest}
          onReset={() => resetPlayMoveRecords().then(reload)}
          resetTestID="reset-hub-play-move-records"
          colors={colors}
        />
      ) : (
        <Session60RecordsPanel
          label="Nommer le coup"
          best={moveNamingBest}
          onReset={() => resetMoveNamingRecords().then(reload)}
          resetTestID="reset-hub-move-naming-records"
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
  const resetAll = () =>
    Alert.alert(
      'Réinitialiser le record ?',
      `Cette action remettra à zéro le meilleur score 60 secondes de ${label}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: onReset,
        },
      ],
    );

  return (
    <View style={styles.panel}>
      <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 1 }}>
          Meilleur score / 60 s
        </Text>
        <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 22 }}>
          {best}
        </Text>
      </View>
      <Pressable onPress={resetAll} style={styles.resetBtn} testID={resetTestID}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
          Réinitialiser
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
  resetBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
});
