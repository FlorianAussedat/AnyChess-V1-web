/**
 * Central require() map for Major Update brand assets.
 * Keep paths relative so Metro can resolve them.
 *
 * ModeCard / Accueil illustrations use the user-supplied `v1-` / `V1-` PNGs only.
 * Do not point menus at AI-generated non-v1 mascot assets.
 */
import type { ImageSourcePropType } from 'react-native';
import type { MainModeId } from '@/lib/app/modes';

export const BrandAssets = {
  logoMark: require('@/assets/brand/logo-mark.png'),
  splash: require('@/assets/brand/splash-brand.png'),
  /** Bottom-nav Accueil — user original (`v1-home-nav.png`). */
  navHome: require('@/assets/brand/nav/v1-home-nav.png'),
  modes: {
    classic: require('@/assets/brand/modes/classic.png'),
    openings: require('@/assets/brand/modes/openings.png'),
    blind: require('@/assets/brand/modes/blind.png'),
    puzzles: require('@/assets/brand/modes/tactics.png'),
    visualisation: require('@/assets/brand/modes/visualisation.png'),
    'quiz-ouverture': require('@/assets/brand/modes/quiz-ouverture.png'),
    target: require('@/assets/brand/modes/target.png'),
  },
  /**
   * User-supplied mascots (exact on-disk names, including casing / double .png).
   * Filenames verified from assets/brand/mascots before wiring.
   */
  mascots: {
    classic: require('@/assets/brand/mascots/V1-mascot-classic-knight-soundwave.png'),
    openings: require('@/assets/brand/mascots/V1-mascot-openings-knight-reading.png.png'),
    blind: require('@/assets/brand/mascots/v1-mascot-blind-knight-blindfold.png'),
    puzzles: require('@/assets/brand/mascots/v1-mascot-tactics-knight-calculator.png'),
    visualisation: require('@/assets/brand/mascots/v1-mascot-visualisation-knight-binoculars.png'),
    'quiz-ouverture': require('@/assets/brand/mascots/V1-mascot-quiz-knight-detective.png'),
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

/** Prefer user v1 mascot art; fall back to legacy mode PNG only if missing. */
export function modeCardIllustration(modeId: MainModeId): ImageSourcePropType {
  return BrandAssets.mascots[modeId] ?? BrandAssets.modes[modeId];
}
