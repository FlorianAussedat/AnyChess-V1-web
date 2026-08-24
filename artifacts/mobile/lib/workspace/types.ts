/**
 * Universal AnyChess workspace payload contract.
 */
export type ChessWorkspaceMode =
  | 'reader'
  | 'analysis'
  | 'free-play'
  | 'finish-vs-engine';

export type ChessWorkspaceSource =
  | 'manual-pgn'
  | 'manual-fen'
  | 'initial-position'
  | 'classic-game'
  | 'opening-training'
  | 'visual-puzzle'
  | 'blindfold-puzzle'
  | 'defend-draw'
  | 'theoretical-endgame'
  | 'other';

export type EngineEvaluation =
  | {
      type: 'cp';
      value: number;
      perspective: 'white';
      depth?: number;
    }
  | {
      type: 'mate';
      value: number;
      perspective: 'white';
      depth?: number;
    };

export type MoveClassification =
  | 'best'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'theory-deviation'
  | 'critical';

export type WorkspaceMove = {
  ply: number;
  san: string;
  uci?: string;
  fenBefore: string;
  fenAfter: string;
  playedBy: 'white' | 'black';
  evaluationAfter?: EngineEvaluation;
  classification?: MoveClassification;
  comment?: string;
};

export type AnalysisMarker = {
  id: string;
  ply: number;
  type:
    | 'first-critical-error'
    | 'objective-lost'
    | 'opening-deviation'
    | 'mode-event';
  label: string;
  detail?: string;
};

export type WorkspaceResult = {
  type: 'win' | 'draw' | 'loss' | 'unfinished';
  reason?: string;
  raw?: string;
};

export type WorkspacePayloadV1 = {
  schemaVersion: 1;
  workspaceMode: ChessWorkspaceMode;
  source: ChessWorkspaceSource;
  sourceAttemptId?: string;
  title: string;
  subtitle?: string;
  initialFen: string;
  pgn?: string;
  moves?: WorkspaceMove[];
  playerColor?: 'white' | 'black';
  orientation: 'white' | 'black';
  result?: WorkspaceResult;
  evaluations?: Array<{ ply: number; evaluation: EngineEvaluation }>;
  markers?: AnalysisMarker[];
  openingContext?: {
    repertoireName?: string;
    expectedMoves?: string[];
    firstDeviationPly?: number;
  };
  engineOpponent?: {
    enabled: boolean;
    color?: 'white' | 'black';
    policy?: 'strict-best';
  };
  returnContext?: {
    kind: 'overlay' | 'route';
    route?: string;
    resultId?: string;
    safeParams?: Record<string, string>;
  };
  metadata?: Record<string, unknown>;
};

export type ChessWorkspacePayload = WorkspacePayloadV1;

export function validateWorkspacePayload(
  raw: unknown,
): { ok: true; payload: ChessWorkspacePayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Workspace payload missing.' };
  }
  const payload = raw as Partial<ChessWorkspacePayload>;
  if (payload.schemaVersion !== 1) {
    return { ok: false, error: 'Workspace payload version unsupported.' };
  }
  if (!payload.workspaceMode) {
    return { ok: false, error: 'Workspace mode missing.' };
  }
  if (!payload.source) {
    return { ok: false, error: 'Workspace source missing.' };
  }
  if (typeof payload.initialFen !== 'string' || payload.initialFen.length === 0) {
    return { ok: false, error: 'Initial FEN missing.' };
  }
  if (payload.orientation !== 'white' && payload.orientation !== 'black') {
    return { ok: false, error: 'Workspace orientation invalid.' };
  }
  if (typeof payload.title !== 'string' || payload.title.length === 0) {
    return { ok: false, error: 'Workspace title missing.' };
  }
  return { ok: true, payload: payload as ChessWorkspacePayload };
}
