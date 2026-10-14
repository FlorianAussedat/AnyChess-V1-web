import { translate, type MessageKey, type MessageParams } from '@/lib/i18n/messages.ts';

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
  'cloud.section': 'COMPTE',
  'cloud.statusUnconfigured': 'Connexion au compte temporairement indisponible.',
  'cloud.statusSignedOut': 'Non connecté',
  'cloud.email': 'E-mail',
  'cloud.password': 'Mot de passe',
  'cloud.signIn': 'Se connecter',
  'cloud.signUp': 'Créer un compte',
  'cloud.recover': 'Mot de passe oublié',
};

export function useColors() {
  return {
    card: '#102040',
    border: '#1C3558',
    foreground: '#DCE8F5',
    mutedForeground: '#5B7FA0',
    primary: '#F5A623',
    primaryForeground: '#102040',
    secondary: '#1C3558',
    destructiveForeground: '#FFFFFF',
    muted: '#0B1A30',
    input: '#070F1E',
    destructive: '#BE3030',
  };
}

export function useTranslation() {
  return {
    t: (key: string, params?: MessageParams) => {
      const known = FR[key];
      if (known == null) return translate('fr', key as MessageKey, params);
      if (!params) return known;
      let text = known;
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{{${name}}}`, String(value));
      }
      return text;
    },
    language: 'fr' as const,
  };
}
