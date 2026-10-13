const FR: Record<string, string> = {
  'a11y.boardHide': 'Masquer l’échiquier',
  'a11y.boardShow': 'Afficher l’échiquier',
  'a11y.boardHidden': 'Échiquier masqué',
  'board.gameContinues': 'La partie continue normalement.',
  'board.show': 'Afficher',
  'game.opponentThinking': 'Réflexion',
  'quiz.stockfishPreparing': 'Préparation de Stockfish…',
  'quiz.stockfishWebError': 'Stockfish n’a pas pu démarrer dans ce navigateur.',
  'quiz.stockfishRetry': 'Réessayer',
  'quiz.stockfishBack': 'Retour',
  'quiz.theoreticalNoAttempts': '—/5',
  'quiz.theoreticalScorePending': 'Note en cours…',
  'quiz.theoreticalRecalculate': 'Recalculer la note',
  'quiz.theoreticalEstimatedScore': 'Note estimée : {{score}}',
  'quiz.theoreticalAttemptWins': '{{attempts}} tentative(s), {{wins}} victoire(s)',
};

export function useColors() {
  return {
    card: '#102040',
    border: '#1C3558',
    foreground: '#DCE8F5',
    mutedForeground: '#5B7FA0',
    primary: '#F5A623',
  };
}

export function useTranslation() {
  return {
    t: (key: string, vars?: Record<string, string | number>) => {
      let text = FR[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{{${name}}}`, String(value));
        }
      }
      return text;
    },
    language: 'fr' as const,
  };
}
