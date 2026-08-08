import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { PuzzleFilterChip } from '@/components/puzzles/PuzzleFilterChip';
import { PuzzleRatingBandSlider } from '@/components/puzzles/PuzzleRatingBandSlider';
import { AppButton } from '@/components/ui/AppButton';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import {
  PIECE_COUNT_BANDS,
  puzzleRepository,
} from '@/lib/puzzles';

export function PuzzleHubPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const {
    selectSubmode,
    setRatingBand,
    setPieceCountBand,
    ratingBandId,
    pieceCountBandId,
    startPuzzle,
    loadError,
    submode,
  } = usePuzzle();
  const [starting, setStarting] = useState(false);
  const packCount = puzzleRepository.count();
  const manifest = puzzleRepository.getManifest();

  const onPickMode = (mode: 'visual' | 'blind') => {
    selectSubmode(mode);
  };

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
    <ModeScreenShell title={t('puzzle.hubTitle')} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={puzzleStyles.body}>
        <Text style={[puzzleStyles.lead, { color: colors.mutedForeground }]}>
          {t('puzzle.hubLead', {
            min: manifest.ratingMin,
            max: manifest.ratingMax,
            count: packCount,
          })}
        </Text>

        <Text style={[puzzleStyles.sectionLabel, { color: colors.mutedForeground }]}>{t('puzzle.mode')}</Text>
        <View style={puzzleStyles.row}>
          <PuzzleFilterChip
            label={t('puzzle.visual')}
            active={submode === 'visual'}
            onPress={() => onPickMode('visual')}
          />
          <PuzzleFilterChip
            label={t('puzzle.blind')}
            active={submode === 'blind'}
            onPress={() => onPickMode('blind')}
          />
        </View>

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
            submode === 'blind'
              ? t('puzzle.startBlind')
              : submode === 'visual'
                ? t('puzzle.startVisual')
                : t('puzzle.chooseMode')
          }
          onPress={() => void onStart()}
          disabled={starting || !submode}
          testID="puzzle-start"
        />

        {starting && <ActivityIndicator color={colors.primary} />}
        {!!loadError && (
          <View style={[puzzleStyles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}>
              {loadError}
            </Text>
            <Text style={[puzzleStyles.hint, { color: colors.mutedForeground, marginTop: 4 }]}>
              {submode === 'blind' ? t('puzzle.noMatchBlind') : t('puzzle.noMatch')}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => router.push('/puzzles/records' as Href)}
          hitSlop={8}
          style={puzzleStyles.recordsLink}
          testID="puzzle-records-link"
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
            {t('records.title')}
          </Text>
        </Pressable>
      </ScrollView>
    </ModeScreenShell>
  );
}
