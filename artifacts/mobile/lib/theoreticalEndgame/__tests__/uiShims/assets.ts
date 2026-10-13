export const BrandAssets = {
  toggles: { board: { on: { uri: 'board-on' }, off: { uri: 'board-off' } } },
};

export const DesignTokens = {
  headerIconButton: 34,
  minTouchTarget: 44,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
  radius: { sm: 10, md: 14, lg: 20 },
  typography: { weightSemiBold: '600', weightBold: '700' },
};

export function computeBoardSize() {
  return 320;
}
