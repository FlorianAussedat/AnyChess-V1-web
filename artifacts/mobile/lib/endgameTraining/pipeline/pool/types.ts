/**
 * Endgame pool pipeline — candidates, curation, manifest (offline only).
 */
import type { DefenderColor } from '../../domain/types.ts';

export const POOL_SCHEMA_VERSION = '1.0.0';
export const PIPELINE_VERSION = '1.0.0';

export type EndgameFamilyKind =
  | 'pawn'
  | 'rook'
  | 'minor-piece'
  | 'rook-and-minor'
  | 'queen'
  | 'mixed';

export type CurationStatus = 'accepted' | 'rejected' | 'disabled';

export type CurationDecision = {
  positionId: string;
  status: CurationStatus;
  reason?: string;
  reviewedAt?: string;
  reviewer?: string;
  notes?: string;
};

export type CurationFile = {
  schemaVersion: string;
  decisions: Record<string, CurationDecision>;
};

export type OriginCriticalMove = {
  uci: string;
  san: string;
  verdictBefore: 'DRAW';
  verdictAfter: 'LOSS';
  evaluationBefore?: number;
  evaluationAfter?: number;
};

export type CandidateCertification =
  | {
      type: 'syzygy';
      result: 'DRAW';
      details: Record<string, unknown>;
    }
  | {
      type: 'stockfish-stable-draw';
      result: 'DRAW';
      details: Record<string, unknown>;
    };

export type PoolCandidate = {
  positionId: string;
  initialFen: string;
  playerColor: DefenderColor;
  objective: 'DRAW';
  family: EndgameFamilyKind;
  tags: string[];
  materialSignature: string;
  source: {
    provider: 'lichess-puzzle' | 'manual';
    sourceId: string;
    gameUrl?: string;
    license: string;
    sourcePly?: number;
    rating?: number | null;
    popularity?: number | null;
    nbPlays?: number | null;
    themes?: string[];
  };
  /** First Lichess puzzle move (human blunder) — metadata only. */
  errorMoveUci?: string;
  originCriticalMove?: OriginCriticalMove;
  certification?: CandidateCertification;
  quality: {
    pieceCount: number;
    safeMoveCount?: number;
    pressureCp?: number;
    expectedDuration?: number;
    liquidationRisk?: number;
    similarityGroup?: string;
  };
  /** Pipeline rejection or pending review. */
  pipelineStatus: 'pending' | 'certified' | 'rejected';
  rejectionReason?: string;
  importedAt: string;
};

export type CandidatesFile = {
  schemaVersion: string;
  seed: string;
  sourceFile?: string;
  sourceSha256?: string;
  generatedAt: string;
  candidates: PoolCandidate[];
};

export type ManualPositionInput = {
  positionId?: string;
  initialFen: string;
  playerColor: DefenderColor;
  family: EndgameFamilyKind;
  tags?: string[];
  source: {
    name: string;
    url?: string;
    license: string;
    notes?: string;
  };
  originCriticalMove?: OriginCriticalMove;
};

export type ManualPositionsFile = {
  schemaVersion: string;
  positions: ManualPositionInput[];
};

export type PoolManifest = {
  schemaVersion: string;
  contentVersion: string;
  generatedAt: string;
  seed: string;
  pipelineVersion: string;
  stockfishVersion?: string;
  lichessSource?: {
    path: string;
    sha256: string;
    license: string;
  };
  activeCount: number;
  activeIds: string[];
  disabledIds: string[];
  rejectedCount: number;
  familyDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
  syzygyCount: number;
  stockfishCount: number;
};

export type PoolBuildReport = {
  generatedAt: string;
  sourceFile?: string;
  sourceSha256?: string;
  rowsScanned: number;
  prefiltered: number;
  candidatesTotal: number;
  certified: number;
  accepted: number;
  rejected: number;
  disabled: number;
  active: number;
  rejectionReasons: Record<string, number>;
  familyDistribution: Record<string, number>;
  forbiddenLegacyIds: string[];
  contentVersion: string;
  parameters: Record<string, unknown>;
};
