import React from 'react';
import { ComingSoonScreen } from '@/components/ComingSoonScreen';

export default function NommerLeCoupPlaceholder() {
  return (
    <ComingSoonScreen
      title="Nommer le coup"
      description="Jeu de vitesse d’une minute : reconnaître le coup affiché (dataset Lichess puzzles)."
      notes={[
        'Délai par challenge : 1 à 10 s',
        'Records persistés localement par délai',
      ]}
    />
  );
}
