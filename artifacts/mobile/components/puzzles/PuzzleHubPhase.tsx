import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { PuzzleFilterChip } from '@/components/puzzles/PuzzleFilterChip';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import {
  PIECE_COUNT_BANDS,
  PUZZLE_RATING_BANDS,
  puzzleRepository,
} from '@/lib/puzzles';

export function PuzzleHubPhase() {
  const colors = useColors();
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
    <ModeScreenShell title="Problèmes / Visualisation" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={puzzleStyles.body}>
        <Text style={[puzzleStyles.lead, { color: colors.mutedForeground }]}>
          Résous des problèmes Lichess hors-ligne (cote puzzle Lichess{' '}
          {manifest.ratingMin}–{manifest.ratingMax}). Pack local : {packCount} problèmes.
        </Text>

        <Text style={[puzzleStyles.sectionLabel, { color: colors.mutedForeground }]}>Mode</Text>
        <View style={puzzleStyles.row}>
          <PuzzleFilterChip
            label="Visuel"
            active={submode === 'visual'}
            onPress={() => onPickMode('visual')}
          />
          <PuzzleFilterChip
            label="À l’aveugle"
            active={submode === 'blind'}
            onPress={() => onPickMode('blind')}
          />
        </View>

        <Text style={[puzzleStyles.sectionLabel, { color: colors.mutedForeground }]}>
          Difficulté (cote puzzle Lichess)
        </Text>
        <View style={puzzleStyles.row}>
          {PUZZLE_RATING_BANDS.map((band) => (
            <PuzzleFilterChip
              key={band.id}
              label={band.label}
              active={ratingBandId === band.id}
              onPress={() => setRatingBand(band.id)}
            />
          ))}
        </View>

        {submode === 'blind' && (
          <>
            <Text style={[puzzleStyles.sectionLabel, { color: colors.mutedForeground }]}>
              Nombre de pièces
            </Text>
            <View style={puzzleStyles.row}>
              {PIECE_COUNT_BANDS.map((band) => (
                <PuzzleFilterChip
                  key={band.id}
                  label={band.label}
                  active={pieceCountBandId === band.id}
                  onPress={() => setPieceCountBand(band.id)}
                />
              ))}
            </View>
          </>
        )}

        <Pressable
          disabled={starting || !submode}
          onPress={() => onStart()}
          style={({ pressed }) => [
            puzzleStyles.cta,
            {
              backgroundColor: colors.primary,
              opacity: starting || !submode || pressed ? 0.55 : 1,
            },
          ]}
        >
          <Text style={[puzzleStyles.ctaLabel, { color: colors.primaryForeground }]}>
            {submode === 'blind'
              ? 'Commencer à l’aveugle'
              : submode === 'visual'
                ? 'Commencer en visuel'
                : 'Choisir un mode'}
          </Text>
        </Pressable>

        {starting && <ActivityIndicator color={colors.primary} />}
        {!!loadError && (
          <View style={[puzzleStyles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}>
              {loadError}
            </Text>
            <Text style={[puzzleStyles.hint, { color: colors.mutedForeground, marginTop: 4 }]}>
              Aucun problème ne correspond à ces filtres. Élargis la cote
              {submode === 'blind' ? ' ou le nombre de pièces' : ''} puis réessaie.
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
            Records
          </Text>
        </Pressable>
      </ScrollView>
    </ModeScreenShell>
  );
}
