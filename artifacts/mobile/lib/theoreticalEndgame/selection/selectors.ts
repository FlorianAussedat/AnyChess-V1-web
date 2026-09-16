/**
 * Position selection — theme, random, non-repeat.
 * Supports multiple positions per theme in the future; this version has one each.
 */
import type { TheoreticalEndgamePosition, TheoreticalThemeId } from '../domain/types.ts';
import { THEORETICAL_ENDGAME_POOL } from '../data/pool.generated.ts';
import { averageComprehensionScore, isThemeMastered } from '../domain/comprehensionScore.ts';
import type { ThemeAttemptRecord } from '../persistence/TheoreticalEndgameStore.ts';

export function listPool(): readonly TheoreticalEndgamePosition[] {
  return THEORETICAL_ENDGAME_POOL.filter((p) => p.active !== false);
}

export function getPositionById(id: string): TheoreticalEndgamePosition | null {
  return listPool().find((p) => p.id === id) ?? null;
}

export function listByTheme(themeId: TheoreticalThemeId): TheoreticalEndgamePosition[] {
  return listPool().filter((p) => p.themeId === themeId);
}

export function pickPositionInTheme(
  themeId: TheoreticalThemeId,
  lastPositionId: string | null,
  rng: () => number = Math.random,
): TheoreticalEndgamePosition | null {
  const pool = listByTheme(themeId);
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0]!;
  const candidates = lastPositionId
    ? pool.filter((p) => p.id !== lastPositionId)
    : pool;
  const pick = candidates.length > 0 ? candidates : pool;
  return pick[Math.floor(rng() * pick.length)]!;
}

export function pickRandomTheme(
  themeScores: Record<string, { attempts: ThemeAttemptRecord[] }>,
  rng: () => number = Math.random,
): { themeId: TheoreticalThemeId; allMastered: boolean } {
  const active: TheoreticalThemeId[] = [];
  const seen = new Set<TheoreticalThemeId>();
  for (const p of listPool()) {
    if (seen.has(p.themeId)) continue;
    seen.add(p.themeId);
    const rec = themeScores[p.themeId]?.attempts ?? [];
    const { score } = averageComprehensionScore(rec);
    if (!isThemeMastered(score)) active.push(p.themeId);
  }
  if (active.length === 0) {
    const all = [...seen];
    return {
      themeId: all[Math.floor(rng() * all.length)]!,
      allMastered: true,
    };
  }
  return {
    themeId: active[Math.floor(rng() * active.length)]!,
    allMastered: false,
  };
}

export function pickRandomFromActiveThemes(
  themeScores: Record<string, { attempts: ThemeAttemptRecord[] }>,
  lastPositionId: string | null,
  rng: () => number = Math.random,
): { position: TheoreticalEndgamePosition; allMastered: boolean } | null {
  const { themeId, allMastered } = pickRandomTheme(themeScores, rng);
  const pos = pickPositionInTheme(themeId, lastPositionId, rng);
  if (!pos) return null;
  return { position: pos, allMastered };
}
