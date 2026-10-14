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
    t: (key: string, params?: MessageParams) =>
      FR[key] ?? translate('fr', key as MessageKey, params),
    language: 'fr' as const,
  };
}
