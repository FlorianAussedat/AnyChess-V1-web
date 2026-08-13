import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssets } from '@/constants/BrandAssets';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { HubModeCard } from '@/components/HubModeCard';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';

export function BlindHubPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const { selectSubmode } = useBlindSequence();
  const router = useRouter();

  return (
    <ModeScreenShell title={t('blind.title')} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text style={[blindStyles.lead, { color: colors.mutedForeground }]}>
          {t('blind.hubLead')}
        </Text>

        <HubModeCard
          title={t('blind.listenReconstruct')}
          description={t('blind.listenReconstructDesc')}
          icon={BrandAssets.exercises.ecouterPuisReconstruire}
          onPress={() => selectSubmode('listen-reconstruct')}
          testID="blind-mode-listen"
        />

        <HubModeCard
          title={t('blind.watchRecite')}
          description={t('blind.watchReciteDesc')}
          icon={BrandAssets.exercises.regarderPuisReciter}
          onPress={() => selectSubmode('watch-recite')}
          testID="blind-mode-watch"
        />
      </ScrollView>
    </ModeScreenShell>
  );
}
