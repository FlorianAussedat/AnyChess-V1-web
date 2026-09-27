import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssets } from '@/constants/BrandAssets';
import { HubScreen } from '@/components/HubScreen';
import { HubModeCard } from '@/components/HubModeCard';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';

export function BlindHubPhase() {
  const { t } = useTranslation();
  const { selectSubmode } = useBlindSequence();
  const router = useRouter();

  return (
    <HubScreen title={t('blind.title')} subtitle={t('blind.hubLead')} onBack={() => router.back()}>
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
    </HubScreen>
  );
}
