/**
 * AnyLyseur domain models (engine-agnostic).
 * Eval convention: White-centric (positive = White advantage).
 * Board flip is visual only and never inverts displayed scores.
 */

export type AnalysisEngineStatus =
  | 'initializing'
  | 'ready'
  | 'analyzing'
  | 'idle'
  | 'error'
  | 'unavailable';

export type AnalysisProfileId = 'fast' | 'normal' | 'deep';

export type AnalysisProfile = {
  id: AnalysisProfileId;
  depth: number;
  movetimeMs: number;
  multiPv: number;
};

export type EngineLine = {
  rank: number;
  depth: number;
  /** Centipawns White-centric; null when mate. */
  scoreCp: number | null;
  /** Mate in N White-centric (positive = White mates). */
  mate: number | null;
  /** UCI principal variation. */
  pv: string[];
  bestMove?: string;
};

export type PositionAnalysis = {
  fen: string;
  depth: number;
  lines: EngineLine[];
  analyzedAt: number;
  profileId: AnalysisProfileId;
  evaluation: number | null;
  mate: number | null;
  bestMove?: string;
};

export type GameNodeAnalysis = {
  nodeId: string;
  fen: string;
  evaluation: number | null;
  mate: number | null;
  bestMove?: string;
  depth: number;
  analyzedAt: number;
  profileId: AnalysisProfileId;
};

/** Reserved for a future classification layer — not shown in V1. */
export type ClassificationInputs = {
  evalBefore: number | null;
  mateBefore: number | null;
  evalAfter: number | null;
  mateAfter: number | null;
  bestMoveUci: string | null;
  playedMoveSan: string | null;
  playedMoveUci: string | null;
};

export type GameAnalysisProgress = {
  done: number;
  total: number;
  running: boolean;
};

export type AnalysisSessionState = {
  engineStatus: AnalysisEngineStatus;
  engineError: string | null;
  profileId: AnalysisProfileId;
  position: PositionAnalysis | null;
  positionRequestId: number;
  analyzingFen: string | null;
  gameNodes: Record<string, GameNodeAnalysis>;
  gameProgress: GameAnalysisProgress;
  arrowsEnabled: boolean;
};
