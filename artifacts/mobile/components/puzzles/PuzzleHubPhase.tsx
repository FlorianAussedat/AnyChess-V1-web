import React from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { HubScreen } from '@/components/HubScreen';
import { HubModeCard } from '@/components/HubModeCard';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';

/**
 * Category hub — card selection only (same pattern as Vision / Mémorisation).
 */
export function PuzzleHubPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { selectSubmode } = usePuzzle();

  return (
    <HubScreen
      title={t('puzzle.hubTitle')}
      subtitle={t('puzzle.hubLead')}
      onBack={() => router.back()}
    >
      <HubModeCard
        title={t('puzzle.visualCardTitle')}
        description={t('puzzle.visualCardDesc')}
        iconName="eye-outline"
        onPress={() => selectSubmode('visual')}
        testID="puzzle-card-visual"
      />
      <HubModeCard
        title={t('puzzle.blindCardTitle')}
        description={t('puzzle.blindCardDesc')}
        iconName="eye-off-outline"
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
