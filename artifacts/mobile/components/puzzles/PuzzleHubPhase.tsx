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
import { useSmartBack } from '@/lib/navigation/useSmartBack';

/**
 * Category hub — card selection only (same pattern as Vision / Mémorisation).
 */
export function PuzzleHubPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const back = useSmartBack('/puzzles' as Href);
  const { selectSubmode } = usePuzzle();

  return (
    <HubScreen
      title={t('puzzle.hubTitle')}
      subtitle={t('puzzle.hubLead')}
      onBack={back}
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
      <HubModeCard
        title={t('quiz.defendsNulle')}
        description={t('quiz.defendsNulleDesc')}
        icon={BrandAssets.exercises.defendsNulle}
        onPress={() => router.push('/puzzles/defends-nulle' as Href)}
        testID="puzzle-card-defends-nulle"
      />
      <HubModeCard
        title={t('quiz.theoreticalEndgameTitle')}
        description={t('quiz.theoreticalEndgameDesc')}
        icon={BrandAssets.exercises.finalesTheoriques}
        onPress={() => router.push('/puzzles/finales-theoriques' as Href)}
        testID="puzzle-card-finales-theoriques"
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
