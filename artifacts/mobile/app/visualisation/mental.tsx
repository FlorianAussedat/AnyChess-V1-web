import React from 'react';
import { ComingSoonScreen } from '@/components/ComingSoonScreen';

export default function MentalPositionPlaceholder() {
  return (
    <ComingSoonScreen
      title="Suivi mental de position"
      description="Cet exercice sera disponible à l’étape suivante (génération de séquence + questions sur la position)."
      notes={[
        'Réutilise Stockfish / séquences contrôlées',
        'Réponses orales ou écrites via un validateur dédié',
      ]}
    />
  );
}
