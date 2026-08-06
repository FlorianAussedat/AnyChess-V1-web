import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';
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
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
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
      contentContainerStyle={[
        styles.page,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + DesignTokens.spacing.md,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
    >
      <ScreenHeader onBack={() => router.back()} title="Records" />
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

      <AppButton
        label="Réinitialiser les records"
        variant="destructive"
        onPress={resetAll}
        testID="reset-puzzle-records"
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: DesignTokens.spacing.md,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    gap: DesignTokens.spacing.sm,
  },
});
