/**
 * Position selection — theme, random, non-repeat.
 */
import type { TheoreticalEndgamePosition, TheoreticalThemeId } from '../domain/types.ts';
import { THEORETICAL_ENDGAME_POOL } from '../data/pool.generated.ts';
import { averageComprehensionScore, isThemeMastered } from '../domain/comprehensionScore.ts';
import type { ThemeAttemptRecord } from '../persistence/TheoreticalEndgameStore.ts';

export function listPool(): readonly TheoreticalEndgamePosition[] {
  return THEORETICAL_ENDGAME_POOL;
}

export function getPositionById(id: string): TheoreticalEndgamePosition | null {
  return THEORETICAL_ENDGAME_POOL.find((p) => p.id === id) ?? null;
}

export function listByTheme(themeId: TheoreticalThemeId): TheoreticalEndgamePosition[] {
  return THEORETICAL_ENDGAME_POOL.filter((p) => p.themeId === themeId);
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
  for (const p of THEORETICAL_ENDGAME_POOL) {
    if (active.includes(p.themeId)) continue;
    const rec = themeScores[p.themeId]?.attempts ?? [];
    const { score } = averageComprehensionScore(rec);
    if (!isThemeMastered(score)) active.push(p.themeId);
  }
  if (active.length === 0) {
    const all = [...new Set(THEORETICAL_ENDGAME_POOL.map((p) => p.themeId))];
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
