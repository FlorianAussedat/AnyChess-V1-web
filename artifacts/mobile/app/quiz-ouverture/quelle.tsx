import React from 'react';
import { ComingSoonScreen } from '@/components/ComingSoonScreen';

export default function QuelleOuverturePlaceholder() {
  return (
    <ComingSoonScreen
      title="Quelle ouverture ?"
      description="Reconnaissance du nom d’ouverture à partir d’une ligne ECO (aliases FR/EN)."
      notes={['Dataset ECO local, pas tes répertoires PGN']}
    />
  );
}
