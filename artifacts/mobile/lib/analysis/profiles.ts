import type { AnalysisProfile, AnalysisProfileId } from './types.ts';

/** Profiles tuned for Stockfish WASM on web (UI stays responsive). */
export const ANALYSIS_PROFILES: Record<AnalysisProfileId, AnalysisProfile> = {
  fast: { id: 'fast', depth: 12, movetimeMs: 250, multiPv: 3 },
  normal: { id: 'normal', depth: 16, movetimeMs: 800, multiPv: 3 },
  deep: { id: 'deep', depth: 20, movetimeMs: 2500, multiPv: 3 },
};

/**
 * Native SF19 reaches the web depth caps far inside the movetime
 * (`go depth N movetime T` stops at whichever comes first). Raise the cap
 * so Fast / Normal / Deep stay time-differentiated on Android. Movetimes
 * stay identical so the UI budget matches web.
 */
export const ANDROID_ANALYSIS_DEPTH_CAP: Record<AnalysisProfileId, number> = {
  fast: 20,
  normal: 26,
  deep: 32,
};

export const DEFAULT_ANALYSIS_PROFILE: AnalysisProfileId = 'normal';

function detectPlatform(): string {
  try {
    const { Platform } = require('react-native') as { Platform?: { OS?: string } };
    return Platform?.OS ?? 'web';
  } catch {
    return 'web';
  }
}

export function resolveAnalysisProfile(
  id: AnalysisProfileId,
  platform: string,
): AnalysisProfile {
  const base = ANALYSIS_PROFILES[id] ?? ANALYSIS_PROFILES.normal;
  if (platform === 'android') {
    return { ...base, depth: ANDROID_ANALYSIS_DEPTH_CAP[base.id] };
  }
  return base;
}

export function getAnalysisProfile(id: AnalysisProfileId): AnalysisProfile {
  return resolveAnalysisProfile(id, detectPlatform());
}
