/**
 * Endgame Training domain — pure types (no React / platform).
 *
 * Evaluation convention (player/defender POV):
 *   0.00 = drawish
 *   negative = opponent advantage
 *   positive = player advantage
 */

export type DefenderColor = 'white' | 'black';

export type EndgameFamilyKind =
  | 'pawn'
  | 'rook'
  | 'minor-piece'
  | 'rook-and-minor'
  | 'queen'
  | 'mixed';

export type EndgameSource = {
  provider: 'lichess-puzzle' | 'manual' | string;
  sourceId?: string;
  gameUrl?: string;
  license: string;
  importedAt?: string;
  sourcePly?: number;
};

export type OriginCriticalMove = {
  uci: string;
  san: string;
  verdictBefore: 'DRAW';
  verdictAfter: 'LOSS';
  evaluationBefore?: number;
  evaluationAfter?: number;
};

export type PositionCertification = {
  type: 'syzygy' | 'stockfish-stable-draw';
  result: 'DRAW';
  details: Record<string, unknown>;
};

export type EndgamePositionQuality = {
  /** Player-POV centipawns at start (≈ 0 for valid starts). */
  initialEvaluation: number;
  validationKind: 'syzygy' | 'stockfish';
  validationDepth?: number;
  defensiveMoveCount?: number;
  pieceCount?: number;
  safeMoveCount?: number;
  pressureCp?: number;
  expectedDuration?: number;
  liquidationRisk?: number;
  similarityGroup?: string;
};

export type EndgameTrainingPosition = {
  id: string;
  fen: string;
  /** Alias for playerColor in dataset docs — side the user defends. */
  defender: DefenderColor;
  objective: 'DRAW';
  source: EndgameSource;
  family: EndgameFamilyKind | string;
  materialSignature: string;
  tags: string[];
  quality: EndgamePositionQuality;
  originCriticalMove?: OriginCriticalMove;
  certification?: PositionCertification;
  /** Hash fingerprint of active pool content — stable per position entry. */
  datasetContentVersion?: string;
  /** Optional internal difficulty hint — never shown as a level selector. */
  estimatedDifficulty?: 'easy' | 'medium' | 'hard';
  pressureType?: string;
};

export type PositionSnapshot = {
  positionId: string;
  initialFen: string;
  playerColor: DefenderColor;
  sourceLabel?: string;
  datasetContentVersion: string;
};

export type EvaluationPoint = {
  /** Player move index after which this eval applies (0 = initial). */
  afterPlayerMove: number;
  /** Full-move / ply label for display (e.g. 13). */
  playerMoveNumber: number;
  fen: string;
  /** Player-POV centipawns. */
  scoreCp: number;
  mateIn: number | null;
  san?: string;
};

export type AttemptOutcome =
  | 'win-official-draw'
  | 'win-30-moves'
  | 'loss'
  | 'abandoned'
  | 'in-progress';

export type OfficialDrawReason =
  | 'stalemate'
  | 'threefold'
  | 'fifty'
  | 'insufficient';

export type DrawAlternativeSummary = {
  san: string;
  scoreCp: number;
};

export type AttemptResult = {
  outcome: AttemptOutcome;
  /** Safe player moves that counted (losing move excluded). */
  movesResisted: number;
  officialDrawReason?: OfficialDrawReason;
  /** Precise regulatory announcement (session-computed). */
  officialResultMessage?: string | null;
  firstMajorTurn?: FirstMajorTurn | null;
  timeline: EvaluationPoint[];
  /** SAN list of all plies played (player + opponent). */
  moveSans: string[];
  startFen: string;
  endFen: string;
  positionId: string;
  /** Minimal position snapshot for history after pool changes. */
  positionSnapshot?: PositionSnapshot;
  finishedAt: string;
  /** FEN immediately before the losing move (loss only). */
  fenBeforeLoss?: string;
  losingSan?: string;
  evalBeforeLossCp?: number;
  evalAfterLossCp?: number;
  drawAlternatives?: DrawAlternativeSummary[];
  drawAlternativesHasMore?: boolean;
  drawAlternativesReliable?: boolean;
};

export type FirstMajorTurn = {
  playerMoveNumber: number;
  san: string;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  message: string;
};

export const ENDGAME_TRAINING_CONFIG = {
  /** Player moves required for the 30-move win. */
  targetPlayerMoves: 30,
  /**
   * Loss threshold in player-POV centipawns.
   * Defeat only when score < LOSS_THRESHOLD_CP (i.e. under −2.00).
   */
  lossThresholdCp: -200,
  /** Near-threshold band that does NOT trigger loss (e.g. −1.99). */
  lossSafeFloorCp: -200,
  /** Extra confirmation think time when crossing −2 (ms). */
  lossConfirmThinkMs: 1500,
  /** Normal opponent think time (ms). */
  opponentThinkMs: 1000,
  /** MultiPV for practical-pressure. */
  multiPv: 5,
  /** Max CP gap from best for practical candidates. */
  maxCpGapFromBest: 40,
  /** First major error: delta ≤ −100 cp (≈ −1.00 pawn). */
  majorErrorDeltaCp: -100,
  /** Gauge visual clamp (player POV). */
  gaugeMinCp: -200,
  gaugeMaxCp: 0,
} as const;
