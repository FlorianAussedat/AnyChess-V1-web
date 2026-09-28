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
    description: 'Joue aux échecs sur l’échiquier ou à la voix.',
    iconName: 'people-outline',
    /** Production transparent mascot PNG still required. */
    requiredMascotAsset: 'mascot-classic-knight-soundwave.png',
  },
  {
    id: 'openings',
    route: '/openings' as Href,
    title: 'Apprends tes ouvertures',
    description: 'Apprends tes ouvertures et entraîne-toi à les rejouer.',
    iconName: 'book-outline',
    requiredMascotAsset: 'mascot-openings-knight-reading.png',
  },
  {
    id: 'blind',
    route: '/blind' as Href,
    title: 'Mémorisation',
    description:
      'Retiens des suites de coups en les écoutant ou en les regardant.',
    iconName: 'eye-off-outline',
    requiredMascotAsset: 'mascot-blind-knight-blindfold.png',
  },
  {
    id: 'puzzles',
    route: '/puzzles' as Href,
    title: 'Entraînement tactique',
    description: 'Résous des problèmes et entraîne tes finales.',
    iconName: 'extension-puzzle-outline',
    requiredMascotAsset: 'mascot-tactics-knight-calculator.png',
  },
  {
    id: 'visualisation',
    route: '/visualisation' as Href,
    title: 'Vision de l’échiquier',
    description:
      'Suis les coups mentalement et repère-les sur l’échiquier.',
    iconName: 'eye-outline',
    requiredMascotAsset: 'mascot-visualisation-knight-binoculars.png',
  },
  {
    id: 'quiz-ouverture',
    route: '/quiz-ouverture' as Href,
    title: 'Culture générale',
    description: 'Reconnais les ouvertures et teste tes connaissances.',
    iconName: 'help-circle-outline',
    requiredMascotAsset: 'mascot-quiz-knight-detective.png',
  },
  {
    id: 'parties',
    route: '/parties' as Href,
    title: 'Analyses de parties',
    description: 'Classe tes parties, rejoue-les et analyse les positions qui t’intéressent.',
    iconName: 'play-circle-outline',
    requiredMascotAsset: 'mascot-player-knight-dj.png',
  },
];
