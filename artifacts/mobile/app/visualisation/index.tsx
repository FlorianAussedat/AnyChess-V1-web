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
    id: 'mental',
    route: '/visualisation/mental' as Href,
    title: 'Suivi mental de position',
    description:
      'Suis une séquence de coups, puis réponds à des questions sur la position obtenue.',
    icon: BrandAssets.modes.visualisation,
  },
  {
    id: 'nommer',
    route: '/visualisation/nommer' as Href,
    title: 'Nommer le coup',
    description: 'Identifie le plus rapidement possible le coup joué sur l’échiquier.',
    icon: BrandAssets.modes.target,
  },
  {
    id: 'jouer',
    route: '/visualisation/jouer' as Href,
    title: 'Jouer le coup',
    description: 'Joue le plus rapidement possible le coup donné.',
    icon: BrandAssets.modes.classic,
  },
];

export default function VisualisationHub() {
  const router = useRouter();
  return (
    <HubScreen
      title="Vision de l’échiquier"
      subtitle="Trois exercices pour entraîner le suivi mental et la reconnaissance rapide de coups."
      onBack={() => router.back()}
    >
      {EXERCISES.map((ex) => (
        <HubModeCard
          key={ex.id}
          testID={`viz-${ex.id}`}
          title={ex.title}
          description={ex.description}
          icon={ex.icon}
          onPress={() => router.push(ex.route)}
        />
      ))}
    </HubScreen>
  );
}
