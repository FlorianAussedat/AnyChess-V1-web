/**
 * AnyChess Design System — shared visual tokens for home, shells and navigation.
 * Colors live in `constants/colors.ts`; this module covers spacing, radii,
 * navigation chrome and typography scale used by the premium UI surfaces.
 *
 * Home density targets (vs reference mockup):
 * - Header ≈ 1/8 viewport (logo row + tagline)
 * - Mode cards ≈ 150–156px, gap ≈ 12
 * - Mascot column ≈ 40–42% of card width
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
    screenX: 24,
    cardGap: 12,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 24,
    card: 20,
  },
  typography: {
    brand: 30,
    title: 24,
    cardTitle: 22,
    body: 14,
    caption: 15,
    micro: 11,
    tagline: 10,
  },
  /**
   * Height of the bottom-nav row (icons + labels), excluding safe-area inset.
   * Root layout reserves this so content is never hidden under the bar.
   */
  bottomNavContentHeight: 58,
  bottomNavIconSize: 22,
  /** Rendered Home PNG box (portrait asset — visible knight ≈ 28–32px). */
  bottomNavHomeIconWidth: 38,
  bottomNavHomeIconHeight: 54,
  minTouchTarget: 44,
  /** Home ModeCard target density (~4 cards above nav). */
  modeCardMinHeight: 150,
  modeCardHeight: 152,
  /** Mascot slot ≈ 40–42% of card; image oversized for portrait PNG content. */
  modeIllustrationWidth: 168,
  modeIllustrationHeight: 180,
} as const;

export type DesignTokensType = typeof DesignTokens;
