import type { TheoreticalTheme, TheoreticalThemeId } from './types.ts';

export const THEORETICAL_THEMES: readonly TheoreticalTheme[] = [
  { id: 'queen-mate', titleKey: 'QueenMate', category: 'elementary-mate', iconKey: 'jouerLeCoup' },
  { id: 'rook-mate', titleKey: 'RookMate', category: 'elementary-mate', iconKey: 'jouerLeCoup' },
  { id: 'two-bishops-mate', titleKey: 'TwoBishopsMate', category: 'elementary-mate', iconKey: 'jouerLeCoup' },
  { id: 'pawn-square', titleKey: 'PawnSquare', category: 'pawn', iconKey: 'defendsNulle' },
  { id: 'opposition', titleKey: 'Opposition', category: 'pawn', iconKey: 'defendsNulle' },
  { id: 'kp-vs-k', titleKey: 'KpVsK', category: 'pawn', iconKey: 'defendsNulle' },
  { id: 'pawn-race', titleKey: 'PawnRace', category: 'pawn', iconKey: 'defendsNulle' },
  { id: 'pawn-breakthrough', titleKey: 'PawnBreakthrough', category: 'pawn', iconKey: 'defendsNulle' },
  { id: 'lucena', titleKey: 'Lucena', category: 'rook', iconKey: 'construisOuverture' },
  { id: 'philidor', titleKey: 'Philidor', category: 'rook', iconKey: 'construisOuverture' },
] as const;

export const THEME_IDS: readonly TheoreticalThemeId[] = THEORETICAL_THEMES.map((t) => t.id);

export function getTheme(id: TheoreticalThemeId): TheoreticalTheme {
  const t = THEORETICAL_THEMES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown theme: ${id}`);
  return t;
}

export function isThemeId(id: string): id is TheoreticalThemeId {
  return THEME_IDS.includes(id as TheoreticalThemeId);
}
