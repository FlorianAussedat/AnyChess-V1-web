/**
 * AnyChess Design System — shared visual tokens.
 *
 * Colors: product is dark-only; the palette lives here as semantic tokens and
 * is also re-exported via `constants/colors.ts` for RN theme plumbing.
 * Board square colors live in `constants/boardTheme.ts`.
 *
 * Home density targets (vs reference mockup):
 * - Header ≈ 1/8 viewport (logo row + tagline)
 * - Mode cards ≈ 150–156px, gap ≈ 12
 * - Mascot column ≈ 40–42% of card width
 */
export const DesignTokens = {
  /**
   * Semantic colors (identical to the historical colors.ts palette).
   * Do not invent new hues here — redesign passes own color changes.
   */
  color: {
    background: '#0B1728',
    foreground: '#DCE8F5',
    text: '#DCE8F5',
    card: '#102040',
    cardForeground: '#DCE8F5',
    primary: '#F5A623',
    primaryForeground: '#0B1728',
    secondary: '#1C3558',
    secondaryForeground: '#DCE8F5',
    muted: '#0E1C34',
    mutedForeground: '#5B7FA0',
    accent: '#1F4080',
    accentForeground: '#ffffff',
    tint: '#F5A623',
    destructive: '#BE3030',
    destructiveForeground: '#ffffff',
    border: '#1C3558',
    input: '#070F1E',
  },
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
    /** Extra padding ModeScreenShell / game screens add beyond safe insets. */
    screenPadExtra: 6,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 24,
    card: 20,
    /** Shared with colors.radius for RN controls. */
    control: 12,
  },
  typography: {
    brand: 30,
    title: 24,
    cardTitle: 22,
    body: 14,
    caption: 15,
    micro: 11,
    tagline: 10,
    /** Mode shell header title. */
    modeTitle: 17,
    weightRegular: 'Inter_400Regular' as const,
    weightSemiBold: 'Inter_600SemiBold' as const,
    weightBold: 'Inter_700Bold' as const,
  },
  /**
   * Web lacks reliable SafeAreaInsets in Expo web — fixed fallbacks matching
   * the values historically inlined across screens (do not change casually).
   */
  webSafeArea: {
    top: 67,
    bottom: 34,
  },
  /**
   * Height of the bottom-nav row (icons + labels), excluding safe-area inset.
   * Root layout reserves this so content is never hidden under the bar.
   * Screens must NOT add this again — only safe-area / content breathing room.
   */
  bottomNavContentHeight: 58,
  bottomNavIconSize: 22,
  /**
   * Accueil nav — outer viewport for ~28–32px VISIBLE artwork.
   * Source PNG has large black padding; image is positioned inside the viewport.
   */
  bottomNavHomeIconWidth: 32,
  bottomNavHomeIconHeight: 32,
  minTouchTarget: 44,
  /** Header back / icon button size used across mode screens. */
  headerIconButton: 34,
  /**
   * Chess gameplay / training screen chrome (Classic Game is the reference).
   * Prefer these over ad-hoc padding so layout changes propagate once.
   */
  chessScreen: {
    paddingHorizontal: 8,
    gap: 4,
    sectionGap: 8,
    inputHeight: 44,
    inputRadius: 10,
    toggleSize: 40,
  },
  /** Home ModeCard target density (~4 cards above nav). */
  modeCardMinHeight: 150,
  modeCardHeight: 152,
  /** Mascot slot ≈ 40–42% of card; image oversized for portrait PNG content. */
  modeIllustrationWidth: 168,
  modeIllustrationHeight: 180,
} as const;

export type DesignTokensType = typeof DesignTokens;
