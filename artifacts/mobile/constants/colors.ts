/**
 * AnyChess theme — deep navy from logo background + gold accent from waves.
 * Single palette (same light/dark) so the board always looks correct.
 */
const colors = {
  light: {
    text: '#DCE8F5',
    tint: '#F5A623',
    background: '#0B1728',
    foreground: '#DCE8F5',
    card: '#102040',
    cardForeground: '#DCE8F5',
    primary: '#F5A623',        // gold — mic / accent buttons
    primaryForeground: '#0B1728',
    secondary: '#1C3558',
    secondaryForeground: '#DCE8F5',
    muted: '#0E1C34',
    mutedForeground: '#5B7FA0',
    accent: '#1F4080',         // knight blue — send button
    accentForeground: '#ffffff',
    destructive: '#BE3030',
    destructiveForeground: '#ffffff',
    border: '#1C3558',
    input: '#070F1E',
  },
  dark: {
    text: '#DCE8F5',
    tint: '#F5A623',
    background: '#0B1728',
    foreground: '#DCE8F5',
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
    destructive: '#BE3030',
    destructiveForeground: '#ffffff',
    border: '#1C3558',
    input: '#070F1E',
  },
  radius: 12,
};

export default colors;
