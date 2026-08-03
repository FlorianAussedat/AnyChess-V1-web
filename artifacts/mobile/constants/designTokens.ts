/**
 * AnyChess Design System — shared visual tokens for home, shells and navigation.
 * Colors live in `constants/colors.ts`; this module covers spacing, radii,
 * navigation chrome and typography scale used by the premium UI surfaces.
 */
export const DesignTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    /** Home screen horizontal margin (~24–28). */
    screenX: 26,
    cardGap: 14,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 24,
    card: 22,
  },
  typography: {
    brand: 30,
    title: 24,
    cardTitle: 24,
    body: 14,
    caption: 16,
    micro: 11,
    tagline: 11,
  },
  /**
   * Height of the bottom-nav row (icons + labels), excluding safe-area inset.
   * Root layout reserves this so content is never hidden under the bar.
   */
  bottomNavContentHeight: 58,
  bottomNavIconSize: 22,
  /** Rendered Home PNG box (portrait asset — sized so visible knight ≈ 26–32px). */
  bottomNavHomeIconWidth: 34,
  bottomNavHomeIconHeight: 48,
  minTouchTarget: 44,
  /** Home ModeCard target density. */
  modeCardMinHeight: 156,
  modeCardHeight: 158,
  /** Mascot slot ≈ 38% of card; image sized larger for portrait PNG content. */
  modeIllustrationWidth: 148,
  modeIllustrationHeight: 168,
} as const;

export type DesignTokensType = typeof DesignTokens;
