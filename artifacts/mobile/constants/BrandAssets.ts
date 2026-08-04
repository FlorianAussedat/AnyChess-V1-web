/**
 * Central require() map for Major Update brand assets.
 * Keep paths relative so Metro can resolve them.
 *
 * Filenames are lowercase kebab-case for Windows/Android/Linux case-safety.
 */
import type { ImageSourcePropType } from 'react-native';
import type { MainModeId } from '@/lib/app/modes';

export const BrandAssets = {
  logoMark: require('@/assets/brand/logo-mark.png'),
  splash: require('@/assets/brand/splash-brand.png'),
  /** Home header — horizontal wordmark + knight. */
  horizontalLogo: require('@/assets/brand/anychess-horizontal-logo.png'),
  /** Bottom-nav Accueil. */
  navHome: require('@/assets/brand/nav/home-nav.png'),
  modes: {
    classic: require('@/assets/brand/modes/classic.png'),
    openings: require('@/assets/brand/modes/openings.png'),
    blind: require('@/assets/brand/modes/blind.png'),
    puzzles: require('@/assets/brand/modes/tactics.png'),
    visualisation: require('@/assets/brand/modes/visualisation.png'),
    'quiz-ouverture': require('@/assets/brand/modes/quiz-ouverture.png'),
    target: require('@/assets/brand/modes/target.png'),
  },
  mascots: {
    classic: require('@/assets/brand/mascots/mascot-classic-knight-soundwave.png'),
    openings: require('@/assets/brand/mascots/mascot-openings-knight-reading.png'),
    blind: require('@/assets/brand/mascots/mascot-blind-knight-blindfold.png'),
    puzzles: require('@/assets/brand/mascots/mascot-tactics-knight-calculator.png'),
    visualisation: require('@/assets/brand/mascots/mascot-visualisation-knight-binoculars.png'),
    'quiz-ouverture': require('@/assets/brand/mascots/mascot-quiz-knight-detective.png'),
  } as Partial<Record<MainModeId, ImageSourcePropType>>,
  sides: {
    white: require('@/assets/brand/sides/white.png'),
    black: require('@/assets/brand/sides/black.png'),
    random: require('@/assets/brand/sides/random.png'),
  },
  toggles: {
    boardOn: require('@/assets/brand/toggles/board-on.png'),
    boardOff: require('@/assets/brand/toggles/board-off.png'),
    micOn: require('@/assets/brand/toggles/mic-on.png'),
    micOff: require('@/assets/brand/toggles/mic-off.png'),
    coordsOn: require('@/assets/brand/toggles/coords-on.png'),
    coordsOff: require('@/assets/brand/toggles/coords-off.png'),
    soundOn: require('@/assets/brand/toggles/sound-on.png'),
    soundOff: require('@/assets/brand/toggles/sound-off.png'),
  },
} as const;

/** Prefer mascot art; fall back to mode PNG only if missing. */
export function modeCardIllustration(modeId: MainModeId): ImageSourcePropType {
  return BrandAssets.mascots[modeId] ?? BrandAssets.modes[modeId];
}
