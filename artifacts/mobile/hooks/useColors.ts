import colors from '@/constants/colors';

/**
 * Returns AnyChess color tokens.
 *
 * The product is dark-only: system light/dark scheme is ignored for palette
 * selection so appearance stays consistent. `radius` remains available for
 * RN controls that historically read it from this hook.
 */
export function useColors() {
  const { palette, radius } = colors;
  return { ...palette, radius };
}
