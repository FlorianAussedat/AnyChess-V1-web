/**
 * Offline Lichess → endgame-training pool pipeline types.
 * Authoring-time only — never loaded at app runtime.
 */
import type {
  DefenderColor,
  EndgameTrainingPosition,
} from '../domain/types.ts';

export type RejectionReason =
  | 'illegal-fen'
  | 'illegal-error-move'
  | 'k-vs-k'
  | 'insufficient-material'
  | 'trivial-dead'
  | 'bare-major-symmetry'
  | 'not-near-draw'
  | 'after-error-not-lost'
  | 'low-defensive-moves'
  | 'duplicate-fen'
  | 'id-filter'
  | 'parse-error'
  | 'analyzer-error';

export type EndgameFamilyKind =
  | 'pawn'
  | 'rook'
  | 'minor'
  | 'queen'
  | 'mixed';

export type PipelineCandidate = {
  puzzleId: string;
  startFen: string;
  errorMove: string;
  afterErrorFen: string;
  defender: DefenderColor;
  rating?: number;
  themes?: string[];
  family: EndgameFamilyKind;
  materialSignature: string;
  /** Defender-POV eval before the error move. */
  evalBeforeCp?: number;
  /** Defender-POV eval after the error move. */
  evalAfterCp?: number;
  mateAfter?: number | null;
  defensiveMoveCount?: number;
};

export type PipelineReport = {
  candidatesAnalyzed: number;
  candidatesAccepted: number;
  rejectionReasons: Partial<Record<RejectionReason, number>>;
  familyDistribution: Partial<Record<EndgameFamilyKind, number>>;
  sources: Record<string, number>;
  materialSignatures: Record<string, number>;
  evalsBefore: number[];
  evalsAfter: number[];
  defensiveMoveCounts: number[];
  duplicatesRemoved: number;
  analysisTimeMs: number;
  engineVersion?: string;
  acceptedIds: string[];
  generatedAt: string;
};

export type PipelineResult = {
  positions: EndgameTrainingPosition[];
  report: PipelineReport;
};

export type CandidateEval = {
  /** Defender-POV centipawns. */
  scoreCp: number;
  mateIn: number | null;
  defensiveMoveCount?: number;
};

/** Optional mock / Stockfish analyzer for offline import. */
export type PipelineAnalyzer = {
  /** Evaluate a FEN from the given defender's POV. */
  evaluate(fen: string, defender: DefenderColor): Promise<CandidateEval>;
  engineVersion?: string;
};
