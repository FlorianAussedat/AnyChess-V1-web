import React from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssets } from '@/constants/BrandAssets';
import { HubScreen } from '@/components/HubScreen';
import { HubModeCard } from '@/components/HubModeCard';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { puzzleRepository } from '@/lib/puzzles';

/**
 * Category hub — card selection only (same pattern as Vision / Mémorisation).
 */
export function PuzzleHubPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { selectSubmode } = usePuzzle();
  const packCount = puzzleRepository.count();
  const manifest = puzzleRepository.getManifest();

  return (
    <HubScreen
      title={t('puzzle.hubTitle')}
      subtitle={t('puzzle.hubLead', {
        min: manifest.ratingMin,
        max: manifest.ratingMax,
        count: packCount,
      })}
      onBack={() => router.back()}
    >
      <HubModeCard
        title={t('puzzle.visualCardTitle')}
        description={t('puzzle.visualCardDesc')}
        icon={BrandAssets.exercises.problemesVisuels}
        onPress={() => selectSubmode('visual')}
        testID="puzzle-card-visual"
      />
      <HubModeCard
        title={t('puzzle.blindCardTitle')}
        description={t('puzzle.blindCardDesc')}
        icon={BrandAssets.exercises.problemesAveugle}
        onPress={() => selectSubmode('blind')}
        testID="puzzle-card-blind"
      />
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
    </HubScreen>
  );
}
