/**
 * Runtime metadata for the theoretical endgame pool.
 * Keep in sync with canonical.positions.json / pool.manifest.json via build.
 */
export const THEORETICAL_POOL_METADATA = {
  datasetVersion: '2.0.0',
  contentVersion: 'canonical-10-v1',
  expectedActiveCount: 10,
  sourceFile: 'lib/theoreticalEndgame/data/canonical.positions.json',
  generatedFile: 'lib/theoreticalEndgame/data/pool.generated.ts',
  removedThemes: ['three-pawns'] as const,
  legacyIdPrefix: 'TE-',
  legacyIdCount: 44,
} as const;
