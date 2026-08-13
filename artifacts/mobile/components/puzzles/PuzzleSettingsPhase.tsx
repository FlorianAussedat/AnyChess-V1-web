import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { PuzzleFilterChip } from '@/components/puzzles/PuzzleFilterChip';
import { PuzzleRatingBandSlider } from '@/components/puzzles/PuzzleRatingBandSlider';
import { AppButton } from '@/components/ui/AppButton';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { PIECE_COUNT_BANDS } from '@/lib/puzzles';

/**
 * Mode setup — difficulty (local, seeded from Settings) + start.
 */
export function PuzzleSettingsPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const {
    setRatingBand,
    setPieceCountBand,
    ratingBandId,
    pieceCountBandId,
    startPuzzle,
    loadError,
    submode,
    backToHub,
  } = usePuzzle();
  const [starting, setStarting] = useState(false);

  const title =
    submode === 'blind'
      ? t('puzzle.blindCardTitle')
      : t('puzzle.visualCardTitle');

  const onStart = async () => {
    if (!submode) return;
    setStarting(true);
    try {
      await startPuzzle();
    } finally {
      setStarting(false);
    }
  };

  return (
    <ModeScreenShell title={title} onBack={backToHub}>
      <ScrollView contentContainerStyle={puzzleStyles.body}>
        <PuzzleRatingBandSlider
          bandId={ratingBandId}
          onBandIdChange={setRatingBand}
          label={t('puzzle.difficulty')}
        />

        <View style={puzzleStyles.row}>
          <PuzzleFilterChip
            label={t('puzzle.randomAll')}
            active={ratingBandId === 'all'}
            onPress={() => setRatingBand('all')}
          />
        </View>

        <Text
          style={[puzzleStyles.hint, { color: colors.mutedForeground }]}
          testID="puzzle-difficulty-hint"
        >
          {t('puzzle.difficultyDefaultHint')}
        </Text>

        {submode === 'blind' && (
          <>
            <Text style={[puzzleStyles.sectionLabel, { color: colors.mutedForeground }]}>
              {t('puzzle.pieceCount')}
            </Text>
            <View style={puzzleStyles.row}>
              {PIECE_COUNT_BANDS.map((band) => (
                <PuzzleFilterChip
                  key={band.id}
                  label={band.id === 'all' ? t('puzzle.all') : band.label}
                  active={pieceCountBandId === band.id}
                  onPress={() => setPieceCountBand(band.id)}
                />
              ))}
            </View>
          </>
        )}

        <AppButton
          label={
            submode === 'blind' ? t('puzzle.startBlind') : t('puzzle.startVisual')
          }
          onPress={() => void onStart()}
          disabled={starting || !submode}
          testID="puzzle-start"
        />

        {starting && <ActivityIndicator color={colors.primary} />}
        {!!loadError && (
          <View
            style={[
              puzzleStyles.statusCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}>
              {loadError}
            </Text>
            <Text style={[puzzleStyles.hint, { color: colors.mutedForeground, marginTop: 4 }]}>
              {submode === 'blind' ? t('puzzle.noMatchBlind') : t('puzzle.noMatch')}
            </Text>
          </View>
        )}
      </ScrollView>
    </ModeScreenShell>
  );
}
