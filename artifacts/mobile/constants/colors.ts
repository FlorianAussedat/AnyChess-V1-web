/**
 * AnyChess theme palette.
 *
 * Product is dark-only. `light` and `dark` both point at the same palette so
 * React Native's useColorScheme / theme plumbing keeps working without
 * pretending we ship distinct light and dark appearances.
 */
import { DesignTokens } from '@/constants/designTokens';

const palette = {
  text: DesignTokens.color.text,
  tint: DesignTokens.color.tint,
  background: DesignTokens.color.background,
  foreground: DesignTokens.color.foreground,
  card: DesignTokens.color.card,
  cardForeground: DesignTokens.color.cardForeground,
  primary: DesignTokens.color.primary,
  primaryForeground: DesignTokens.color.primaryForeground,
  secondary: DesignTokens.color.secondary,
  secondaryForeground: DesignTokens.color.secondaryForeground,
  muted: DesignTokens.color.muted,
  mutedForeground: DesignTokens.color.mutedForeground,
  accent: DesignTokens.color.accent,
  accentForeground: DesignTokens.color.accentForeground,
  destructive: DesignTokens.color.destructive,
  destructiveForeground: DesignTokens.color.destructiveForeground,
  border: DesignTokens.color.border,
  input: DesignTokens.color.input,
} as const;

const colors = {
  /** Shared dark palette (also used when system scheme is "light"). */
  light: palette,
  /** Same as light — AnyChess does not implement a separate light mode. */
  dark: palette,
  /** Canonical alias — prefer this when not dealing with RN ColorScheme. */
  palette,
  radius: DesignTokens.radius.control,
};

export default colors;
