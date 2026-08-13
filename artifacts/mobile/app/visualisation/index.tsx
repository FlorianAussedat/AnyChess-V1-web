import React from 'react';
import { useRouter, type Href } from 'expo-router';
import { BrandAssets } from '@/constants/BrandAssets';
import { HubScreen } from '@/components/HubScreen';
import { HubModeCard } from '@/components/HubModeCard';
import { useTranslation } from '@/hooks/useTranslation';
import type { MessageKey } from '@/lib/i18n';
import type { ImageSourcePropType } from 'react-native';

type ExerciseCard = {
  id: string;
  route: Href;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: ImageSourcePropType;
};

const EXERCISES: ExerciseCard[] = [
  {
    id: 'mental',
    route: '/visualisation/mental' as Href,
    titleKey: 'vision.mental',
    descriptionKey: 'vision.mentalDesc',
    icon: BrandAssets.exercises.suiviMental,
  },
  {
    id: 'nommer',
    route: '/visualisation/nommer' as Href,
    titleKey: 'vision.nommer',
    descriptionKey: 'vision.nommerDesc',
    icon: BrandAssets.exercises.nommerLeCoup,
  },
  {
    id: 'jouer',
    route: '/visualisation/jouer' as Href,
    titleKey: 'vision.jouer',
    descriptionKey: 'vision.jouerDesc',
    icon: BrandAssets.exercises.jouerLeCoup,
  },
];

export default function VisualisationHub() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <HubScreen
      title={t('vision.title')}
      subtitle={t('vision.subtitle')}
      onBack={() => router.back()}
    >
      {EXERCISES.map((ex) => (
        <HubModeCard
          key={ex.id}
          testID={`viz-${ex.id}`}
          title={t(ex.titleKey)}
          description={t(ex.descriptionKey)}
          icon={ex.icon}
          onPress={() => router.push(ex.route)}
        />
      ))}
    </HubScreen>
  );
}
