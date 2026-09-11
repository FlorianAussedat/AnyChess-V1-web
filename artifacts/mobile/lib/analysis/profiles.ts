import type { AnalysisProfile, AnalysisProfileId } from './types.ts';

/** Profiles tuned for Stockfish WASM on web (UI stays responsive). */
export const ANALYSIS_PROFILES: Record<AnalysisProfileId, AnalysisProfile> = {
  fast: { id: 'fast', depth: 12, movetimeMs: 250, multiPv: 3 },
  normal: { id: 'normal', depth: 16, movetimeMs: 800, multiPv: 3 },
  deep: { id: 'deep', depth: 20, movetimeMs: 2500, multiPv: 3 },
};

export const DEFAULT_ANALYSIS_PROFILE: AnalysisProfileId = 'normal';

export function getAnalysisProfile(id: AnalysisProfileId): AnalysisProfile {
  return ANALYSIS_PROFILES[id] ?? ANALYSIS_PROFILES.normal;
}
