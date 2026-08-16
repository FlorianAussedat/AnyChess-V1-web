/**
 * Pure mode-card metadata (no image requires) — safe for node tests.
 */
import type { Href } from 'expo-router';
import type { MainModeId } from './modes.ts';

/** Ionicons glyph name used by ModeCard thematic icons. */
export type ModeIconName = string;

export interface MainModeCardMeta {
  id: MainModeId;
  route: Href;
  title: string;
  description: string;
  iconName: ModeIconName;
  /** Production transparent mascot PNG still required. */
  requiredMascotAsset: string;
}

export const MAIN_MODE_CARD_META: MainModeCardMeta[] = [
  {
    id: 'classic',
    route: '/classic' as Href,
    title: 'Partie classique',
    description:
      'Joue une partie, tout simplement ! À la voix ou directement sur l’échiquier.',
    iconName: 'people-outline',
    /** Production transparent mascot PNG still required. */
    requiredMascotAsset: 'mascot-classic-knight-soundwave.png',
  },
  {
    id: 'openings',
    route: '/openings' as Href,
    title: 'Apprends tes ouvertures',
    description: 'Apprends et révise tes répertoires d’ouvertures, coup après coup.',
    iconName: 'book-outline',
    requiredMascotAsset: 'mascot-openings-knight-reading.png',
  },
  {
    id: 'blind',
    route: '/blind' as Href,
    title: 'Mémorisation',
    description:
      'Entraîne-toi à retenir des séquences de coups, à l’écoute ou en les observant.',
    iconName: 'eye-off-outline',
    requiredMascotAsset: 'mascot-blind-knight-blindfold.png',
  },
  {
    id: 'puzzles',
    route: '/puzzles' as Href,
    title: 'Entraînement tactique',
    description: 'Résous des positions tactiques, avec ou sans échiquier visible.',
    iconName: 'extension-puzzle-outline',
    requiredMascotAsset: 'mascot-tactics-knight-calculator.png',
  },
  {
    id: 'visualisation',
    route: '/visualisation' as Href,
    title: 'Vision de l’échiquier',
    description:
      'Entraîne-toi à suivre une position mentalement et à reconnaître rapidement les coups.',
    iconName: 'eye-outline',
    requiredMascotAsset: 'mascot-visualisation-knight-binoculars.png',
  },
  {
    id: 'quiz-ouverture',
    route: '/quiz-ouverture' as Href,
    title: 'Culture générale',
    description: 'Teste tes connaissances sur les ouvertures et la culture échiquéenne.',
    iconName: 'help-circle-outline',
    requiredMascotAsset: 'mascot-quiz-knight-detective.png',
  },
  {
    id: 'parties',
    route: '/parties' as Href,
    title: 'Parties',
    description:
      'Importe des PGN et rejoue-les à vue ou à l’écoute, coup après coup.',
    iconName: 'play-circle-outline',
    /** Temporary: reuse openings mascot until a dedicated asset ships. */
    requiredMascotAsset: 'mascot-openings-knight-reading.png',
  },
];
