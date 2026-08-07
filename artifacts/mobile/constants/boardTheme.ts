/**
 * Chess board visual constants.
 *
 * Kept separate from general DesignTokens so future board themes can swap
 * without editing ChessBoard rendering logic. Values match the historical
 * hardcoded navy palette — do not change casually.
 */
export const BoardTheme = {
  lightSquare: '#738FA8',
  darkSquare: '#3D5472',
  /** Gold highlight — logo waves. */
  lightLastMove: 'rgba(245,166,35,0.60)',
  darkLastMove: 'rgba(200,120,0,0.60)',
  lightSelected: 'rgba(80,160,255,0.70)',
  darkSelected: 'rgba(40,120,220,0.70)',
  coordOnLight: 'rgba(255,255,255,0.70)',
  coordOnDark: 'rgba(180,210,240,0.80)',
  border: '#1C3558',
} as const;

export type BoardThemeType = typeof BoardTheme;
