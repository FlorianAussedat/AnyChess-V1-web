import type { ImageSourcePropType } from 'react-native';
import { isMascotId, type MascotId } from '@/lib/profile/mascotCatalog';

/**
 * Source PNGs already in the project. Display WebPs are the same drawings,
 * not extra mascots. Required here so a chosen mascot renders offline.
 */
const SOURCES: Record<MascotId, ImageSourcePropType> = {
  'classic-knight-soundwave': require('@/assets/brand/mascots/mascot-classic-knight-soundwave.png'),
  'openings-knight-reading': require('@/assets/brand/mascots/mascot-openings-knight-reading.png'),
  'blind-knight-blindfold': require('@/assets/brand/mascots/mascot-blind-knight-blindfold.png'),
  'tactics-knight-calculator': require('@/assets/brand/mascots/mascot-tactics-knight-calculator.png'),
  'visualisation-knight-binoculars': require('@/assets/brand/mascots/mascot-visualisation-knight-binoculars.png'),
  'quiz-knight-detective': require('@/assets/brand/mascots/mascot-quiz-knight-detective.png'),
  'player-knight-dj': require('@/assets/brand/mascots/mascot-player-knight-dj.png'),
  'difficulty-debutant': require('@/assets/brand/mascots/difficulty/debutant.png'),
  'difficulty-confirme': require('@/assets/brand/mascots/difficulty/confirme.png'),
  'difficulty-expert': require('@/assets/brand/mascots/difficulty/expert.png'),
  'difficulty-gm': require('@/assets/brand/mascots/difficulty/GM.png'),
};

export function mascotImage(id: string | null | undefined): ImageSourcePropType | null {
  if (!isMascotId(id)) return null;
  return SOURCES[id];
}
