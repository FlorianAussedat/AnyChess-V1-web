/**
 * Central require() map for Major Update brand assets.
 * Keep paths relative so Metro can resolve them.
 *
 * Home ModeCard mascots currently reuse `modes/*` PNGs (often on light plates).
 * Final transparent knight-family assets still required — see
 * `MAIN_MODE_CARDS[].requiredMascotAsset` in `lib/app/mainModeCards.ts`.
 */
export const BrandAssets = {
  logoMark: require('@/assets/brand/logo-mark.png'),
  splash: require('@/assets/brand/splash-brand.png'),
  /** Bottom-nav Accueil: knight + gold roof + soundwave (not a generic house). */
  navHome: require('@/assets/brand/nav/home.png'),
  modes: {
    classic: require('@/assets/brand/modes/classic.png'),
    openings: require('@/assets/brand/modes/openings.png'),
    blind: require('@/assets/brand/modes/blind.png'),
    puzzles: require('@/assets/brand/modes/tactics.png'),
    visualisation: require('@/assets/brand/modes/visualisation.png'),
    'quiz-ouverture': require('@/assets/brand/modes/quiz-ouverture.png'),
    target: require('@/assets/brand/modes/target.png'),
  },
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
