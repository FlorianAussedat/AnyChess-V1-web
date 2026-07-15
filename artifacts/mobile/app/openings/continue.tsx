import React from 'react';
import { ComingSoonScreen } from '@/components/ComingSoonScreen';
import { useLocalSearchParams } from 'expo-router';

/**
 * Stage 1 shell for Continue la ligne.
 * Stage 2 will implement repertoire branch selection + recitation.
 */
export default function ContinueLinePlaceholder() {
  const { folderId } = useLocalSearchParams<{ folderId?: string }>();
  return (
    <ComingSoonScreen
      title="Continue la ligne"
      description="Récite la suite d’une branche de ton répertoire PGN (fusion des fichiers du dossier)."
      notes={[
        folderId ? `Dossier : ${folderId}` : 'Choisis un répertoire depuis Ouvertures',
        'Toutes les suites valides du répertoire seront acceptées',
        'Implémentation prévue à l’étape 2',
      ]}
    />
  );
}
