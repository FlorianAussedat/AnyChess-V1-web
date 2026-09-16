/**
 * Platform-agnostic analysis engine contract for AnyLyseur.
 * UI never speaks UCI — only this interface.
 */
import type { EngineAnalysis } from '@/lib/engines/analysis';
import type { AnalysisProfile } from '../types.ts';

export type AnalyzePositionRequest = {
  fen: string;
  profile: AnalysisProfile;
  multiPv?: number;
  requestId?: number;
};

export type ChessEngineLifecycleStatus =
  | 'initializing'
  | 'ready'
  | 'analyzing'
  | 'error'
  | 'unavailable';

export interface ChessEngine {
  init(): Promise<void>;
  getStatus(): ChessEngineLifecycleStatus;
  analyzePosition(req: AnalyzePositionRequest): Promise<EngineAnalysis>;
  stop(): Promise<void>;
  dispose(): void;
}
