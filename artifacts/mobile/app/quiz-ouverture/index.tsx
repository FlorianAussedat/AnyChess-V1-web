import React from 'react';
import { useRouter, type Href } from 'expo-router';
import { BrandAssets } from '@/constants/BrandAssets';
import { HubScreen } from '@/components/HubScreen';
import { HubModeCard } from '@/components/HubModeCard';
import type { ImageSourcePropType } from 'react-native';

type ExerciseCard = {
  id: string;
  route: Href;
  title: string;
  description: string;
  icon: ImageSourcePropType;
};

const EXERCISES: ExerciseCard[] = [
  {
    id: 'quelle',
    route: '/quiz-ouverture/quelle' as Href,
    title: 'Quelle ouverture ?',
    description: 'Reconnais le nom de l’ouverture à partir de la ligne jouée (base ECO).',
    icon: BrandAssets.modes['quiz-ouverture'],
  },
  {
    id: 'construis',
    route: '/quiz-ouverture/construis' as Href,
    title: 'Construis l’ouverture',
    description: 'Dicte la ligne jusqu’à la position qui identifie l’ouverture demandée.',
    icon: BrandAssets.modes.openings,
  },
  {
    id: 'culture',
    route: '/quiz-ouverture/culture' as Href,
    title: 'Quiz',
    description:
      'Teste ta culture échiquéenne avec des questions variées sur l’histoire, les champions, les règles, les tournois et le monde des échecs.',
    icon: BrandAssets.modes.target,
  },
];

export default function QuizOuvertureHub() {
  const router = useRouter();
  return (
    <HubScreen
      title="Culture générale"
      subtitle="Utilise la base d’ouvertures ECO locale — indépendante de tes répertoires PGN."
      onBack={() => router.back()}
    >
      {EXERCISES.map((ex) => (
        <HubModeCard
          key={ex.id}
          testID={`quiz-${ex.id}`}
          title={ex.title}
          description={ex.description}
          icon={ex.icon}
          onPress={() => router.push(ex.route)}
        />
      ))}
    </HubScreen>
  );
}
