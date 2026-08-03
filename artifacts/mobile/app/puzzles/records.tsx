import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { useColors } from '@/hooks/useColors';
import {
  PIECE_COUNT_BANDS,
  PUZZLE_RATING_BANDS,
  puzzleStreakStore,
  type PuzzleStreakState,
  emptyStreakState,
} from '@/lib/puzzles';
import { formatStreakBandLabel } from '@/lib/puzzles/streakBand';

function ratingLabel(id: string): string {
  return PUZZLE_RATING_BANDS.find((b) => b.id === id)?.label ?? id;
}

function pieceLabel(id: string): string {
  return PIECE_COUNT_BANDS.find((b) => b.id === id)?.label ?? id;
}

export default function PuzzleRecordsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<PuzzleStreakState>(emptyStreakState());

  const load = useCallback(() => {
    puzzleStreakStore
      .getSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshot(emptyStreakState()));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          onPress: () => puzzleStreakStore.resetAll().then(load),
        },
      ],
    );

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
    >
      <BackButton onPress={() => router.back()} label="Retour" />
      <Text style={[styles.title, { color: colors.foreground }]}>Records</Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>
        Meilleures séries par bande de difficulté
      </Text>

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
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>
              {snapshot.bestByBand[bandId] ?? 0}
            </Text>
          </View>
        ))
      )}

      <Pressable onPress={resetAll} style={styles.resetBtn} testID="reset-puzzle-records">
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
          Réinitialiser les records
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, gap: 12 },
  title: { fontSize: 25, fontFamily: 'Inter_700Bold' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 13,
    borderWidth: 1,
    borderRadius: 10,
    gap: 10,
  },
  resetBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
});
