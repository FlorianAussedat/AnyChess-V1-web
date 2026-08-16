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
    id: 'quelle',
    route: '/quiz-ouverture/quelle' as Href,
    titleKey: 'quiz.quelle',
    descriptionKey: 'quiz.quelleDesc',
    icon: BrandAssets.exercises.quelleOuverture,
  },
  {
    id: 'culture',
    route: '/quiz-ouverture/culture' as Href,
    titleKey: 'quiz.quiz',
    descriptionKey: 'quiz.cultureDesc',
    icon: BrandAssets.exercises.quiz,
  },
];

export default function QuizOuvertureHub() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <HubScreen
      title={t('quiz.title')}
      subtitle={t('quiz.subtitle')}
      onBack={() => router.back()}
    >
      {EXERCISES.map((ex) => (
        <HubModeCard
          key={ex.id}
          testID={`quiz-${ex.id}`}
          title={t(ex.titleKey)}
          description={t(ex.descriptionKey)}
          icon={ex.icon}
          onPress={() => router.push(ex.route)}
        />
      ))}
    </HubScreen>
  );
}
