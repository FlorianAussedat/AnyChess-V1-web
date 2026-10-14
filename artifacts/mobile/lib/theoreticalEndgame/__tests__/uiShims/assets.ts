export const BrandAssets = {
  toggles: { board: { on: { uri: 'board-on' }, off: { uri: 'board-off' } } },
};

export const DesignTokens = {
  headerIconButton: 34,
  spacing: { xs: 4, sm: 8, md: 12 },
  radius: { sm: 4, md: 8 },
  typography: { body: 14, micro: 11, weightSemiBold: '600', weightBold: '700' },
};

export function computeBoardSize() {
  return 320;
}
