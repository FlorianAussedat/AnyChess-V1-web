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
    description: 'Joue une partie complète contre Stockfish, à la voix ou au doigt.',
    iconName: 'people-outline',
    /** Supplied: assets/brand/mascots/mascot-classic-knight-soundwave.png */
    requiredMascotAsset: 'mascot-classic-knight-soundwave.png',
  },
  {
    id: 'openings',
    route: '/openings' as Href,
    title: 'Ouvertures',
    description: 'Joue contre ton répertoire ou continue une ligne PGN importée.',
    iconName: 'book-outline',
    /** Supplied: assets/brand/mascots/mascot-openings-knight-reading.png */
    requiredMascotAsset: 'mascot-openings-knight-reading.png',
  },
  {
    id: 'blind',
    route: '/blind' as Href,
    title: 'Séquences à l’aveugle',
    description: 'Mémorise une séquence dictée, puis reconstruis-la sur l’échiquier.',
    iconName: 'eye-off-outline',
    /** Supplied: assets/brand/mascots/mascot-blind-knight-blindfold.png */
    requiredMascotAsset: 'mascot-blind-knight-blindfold.png',
  },
  {
    id: 'puzzles',
    route: '/puzzles' as Href,
    title: 'Tactiques',
    description: 'Résous des problèmes Lichess à vue ou à l’aveugle, hors-ligne.',
    iconName: 'extension-puzzle-outline',
    requiredMascotAsset: 'mascot-tactics-knight-calculator.png',
  },
  {
    id: 'visualisation',
    route: '/visualisation' as Href,
    title: 'Visualisation',
    description: 'Suivi mental de position et reconnaissance rapide de coups.',
    iconName: 'eye-outline',
    requiredMascotAsset: 'mascot-visualisation-knight-binoculars.png',
  },
  {
    id: 'quiz-ouverture',
    route: '/quiz-ouverture' as Href,
    title: 'Quiz Ouverture',
    description: 'Nomme ou construis des ouvertures à partir de la base ECO.',
    iconName: 'help-circle-outline',
    requiredMascotAsset: 'mascot-quiz-knight-detective.png',
  },
];
