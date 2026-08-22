/**
 * Engine move policy configuration shared across endgame modes.
 */
export type EngineMovePolicy =
  | { type: 'strict-best'; thinkTimeMs: number }
  | { type: 'practical-pressure'; thinkTimeMs: number; multiPv: number; maxCpGapFromBest?: number };

export const STRICT_BEST_DEFAULT: EngineMovePolicy = {
  type: 'strict-best',
  thinkTimeMs: 1000,
};

export const PRACTICAL_PRESSURE_DEFAULT: EngineMovePolicy = {
  type: 'practical-pressure',
  thinkTimeMs: 1000,
  multiPv: 5,
  maxCpGapFromBest: 40,
};
