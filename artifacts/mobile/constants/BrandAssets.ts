/**
 * Central require() map for Major Update brand assets.
 * Keep paths relative so Metro can resolve them.
 *
 * Filenames under assets/brand are lowercase kebab-case for
 * Windows/Android/Linux case-safety where possible.
 *
 * ModeCard / Accueil illustrations use lightweight `display/` WebP copies
 * derived from the user-supplied `v1-` / `V1-` PNGs (originals untouched).
 * Regenerate with: `pnpm run optimize:brand-display`
 */
import type { ImageSourcePropType } from 'react-native';
import type { MainModeId } from '@/lib/app/modes';

export const BrandAssets = {
  logoMark: require('@/assets/brand/logo-mark.png'),
  splash: require('@/assets/brand/splash-brand.png'),
  /** Home header — optimized display WebP (source: v1-anychess-horizontal-logo.png). */
  horizontalLogo: require('@/assets/brand/display/v1-anychess-horizontal-logo.webp'),
  /** Bottom-nav Accueil — optimized display WebP (source: v1-home-nav.png). */
  navHome: require('@/assets/brand/display/nav/v1-home-nav.webp'),
  modes: {
    classic: require('@/assets/brand/modes/classic.png'),
    openings: require('@/assets/brand/modes/openings.png'),
    blind: require('@/assets/brand/modes/blind.png'),
    puzzles: require('@/assets/brand/modes/tactics.png'),
    visualisation: require('@/assets/brand/modes/visualisation.png'),
    'quiz-ouverture': require('@/assets/brand/modes/quiz-ouverture.png'),
    parties: require('@/assets/brand/mascots/mascot-player-knight-dj.png'),
    target: require('@/assets/brand/modes/target.png'),
  },
  /**
   * HubModeCard exercise mascots — lightweight display WebPs (192px).
   * Sources: assets/brand/modes/*.png (originals untouched).
   * Regenerate with: `pnpm run optimize:brand-display`
   * HubModeCard renders these at 52×52 (contain).
   */
  exercises: {
    construisOuverture: require('@/assets/brand/display/modes/construis-ouverture.webp'),
    ecouterPuisReconstruire: require('@/assets/brand/display/modes/ecouter-puis-reconstruire.webp'),
    problemesVisuels: require('@/assets/brand/display/modes/problemes-visuels.webp'),
    quiz: require('@/assets/brand/display/modes/quiz.webp'),
    suiviMental: require('@/assets/brand/display/modes/suivi-mental-de-position.webp'),
    jouerLeCoup: require('@/assets/brand/display/modes/jouer-le-coup.webp'),
    regarderPuisReciter: require('@/assets/brand/display/modes/regarder-puis-reciter.webp'),
    problemesAveugle: require('@/assets/brand/display/modes/problemes-a-l-aveugle.webp'),
    nommerLeCoup: require('@/assets/brand/display/modes/nommer-le-coup.webp'),
    quelleOuverture: require('@/assets/brand/display/modes/quelle-ouverture.webp'),
  },
  /**
   * Home ModeCard mascots — optimized display WebPs from user v1 originals.
   * Filenames mirror sources (double .png collapsed to single stem).
   */
  mascots: {
    classic: require('@/assets/brand/display/mascots/V1-mascot-classic-knight-soundwave.webp'),
    openings: require('@/assets/brand/display/mascots/V1-mascot-openings-knight-reading.webp'),
    blind: require('@/assets/brand/display/mascots/v1-mascot-blind-knight-blindfold.webp'),
    puzzles: require('@/assets/brand/display/mascots/v1-mascot-tactics-knight-calculator.webp'),
    visualisation: require('@/assets/brand/display/mascots/v1-mascot-visualisation-knight-binoculars.webp'),
    'quiz-ouverture': require('@/assets/brand/display/mascots/V1-mascot-quiz-knight-detective.webp'),
    parties: require('@/assets/brand/display/mascots/mascot-player-knight-dj.webp'),
  } as Partial<Record<MainModeId, ImageSourcePropType>>,
  sides: {
    white: require('@/assets/brand/sides/white.png'),
    black: require('@/assets/brand/sides/black.png'),
    random: require('@/assets/brand/sides/random.png'),
  },
  toggles: {
    board: {
      on: require('@/assets/brand/toggles/Board-ON.png'),
      off: require('@/assets/brand/toggles/Board-OFF.png'),
    },
    coordinates: {
      on: require('@/assets/brand/toggles/Coordonnee-ON.png'),
      off: require('@/assets/brand/toggles/Coordonnee-OFF.png'),
    },
    speaker: {
      on: require('@/assets/brand/toggles/VoixApp-On.png'),
      off: require('@/assets/brand/toggles/VoixApp-Off.png'),
    },
    /** Player mic (Parler) — not the app voice toggle. */
    mic: {
      on: require('@/assets/brand/toggles/mic-on.png'),
      off: require('@/assets/brand/toggles/mic-off.png'),
    },
  },
} as const;

/** Prefer mascot art; fall back to mode PNG only if missing. */
export function modeCardIllustration(modeId: MainModeId): ImageSourcePropType {
  return BrandAssets.mascots[modeId] ?? BrandAssets.modes[modeId];
}

/** Home-critical brand modules to warm during splash (logo + nav + mode mascots). */
export function homeBrandImageModules(): ImageSourcePropType[] {
  return [
    BrandAssets.horizontalLogo,
    BrandAssets.navHome,
    ...Object.values(BrandAssets.mascots).filter(Boolean),
  ] as ImageSourcePropType[];
}
