import React from 'react';
import { ComingSoonScreen } from '@/components/ComingSoonScreen';

export default function ConstruisOuverturePlaceholder() {
  return (
    <ComingSoonScreen
      title="Construis l’ouverture"
      description="Dicte la ligne jusqu’à la position qui identifie l’ouverture demandée."
      notes={['Validation coup par coup via le parser d’échecs partagé']}
    />
  );
}
