import React from 'react';
import { ModePlaceholder } from '@/components/ModePlaceholder';

export default function BlindRoute() {
  return (
    <ModePlaceholder
      title="Séquences à l’aveugle"
      icon="eye-off-outline"
      message="Le mode d’entraînement à l’aveugle (dictée, reconstruction, score) arrive à une étape ultérieure."
    />
  );
}
