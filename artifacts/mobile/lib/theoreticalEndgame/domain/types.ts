/**
 * Theoretical endgame training — pure domain types.
 *
 * Score scales:
 * - legacy-10: historical attempts graded by a target-move ratio. Kept for
 *   history only. Never averaged with quality-5.
 * - quality-5: current scale (theoretical-quality-v1). See comprehensionScore.ts.
 */
export type PlayerColor = 'white' | 'black';

export type TheoreticalObjective = 'WIN' | 'DRAW';

export type ObjectiveKind =
  | 'mate'
  | 'win'
  | 'draw'
  | 'stop-pawn'
  | 'promote-and-win';

export type TheoreticalThemeId =
  | 'queen-mate'
  | 'rook-mate'
  | 'two-bishops-mate'
  | 'pawn-square'
  | 'opposition'
  | 'kp-vs-k'
  | 'pawn-race'
  | 'pawn-breakthrough'
  | 'lucena'
  | 'philidor'
  | 'key-squares'
  | 'rook-pawn'
  | 'outside-passed'
  | 'triangulation'
  | 'bad-bishop'
  | 'queen-vs-pawn'
  | 'lateral-checks'
  | 'vancura';

export type CompletionRule =
  | { type: 'CHECKMATE' }
  | { type: 'OFFICIAL_GAME_RESULT' };

export type PositionCertification =
  | { type: 'SYZYGY'; result: TheoreticalObjective }
  | { type: 'ENGINE'; engine: string; depth: number; result: TheoreticalObjective };

/** How the catalog proof was obtained. Play never calls this service. */
export type PositionProof = {
  method: 'syzygy-7' | 'stockfish-18-lite-depth-16';
  /** exact = 7-man tablebase. engine = deep search, not a tablebase proof. */
  confidence: 'exact' | 'engine';
  /** Theoretical result from the user's side at the start. */
  playerResult: 'WIN' | 'DRAW' | 'LOSS';
  dtz: number | null;
  /** Exact distance to mate in plies when confidence is exact and the side is winning. */
  dtm: number | null;
  consultedAt: string;
  bestMove?: string;
  depth?: number;
  centipawn?: number;
};

export type PositionSource = {
  name: string;
  url?: string;
  license: string;
};

export type EndgameExplanation = {
  principle: string;
  seek: string;
  method: string;
  avoid: string;
};

export type BilingualExplanation = {
  fr: EndgameExplanation;
  en: EndgameExplanation;
};

export type TheoreticalEndgamePosition = {
  id: string;
  themeId: TheoreticalThemeId;
  initialFen: string;
  playerColor: PlayerColor;
  objective: TheoreticalObjective;
  /** Pedagogical label, finer than WIN/DRAW. */
  objectiveKind: ObjectiveKind;
  completion: CompletionRule;
  certification: PositionCertification;
  proof: PositionProof;
  /** Content revision of this variant. Historical attempts keep their own scale. */
  contentVersion: string;
  diagramOrientation: PlayerColor;
  explanation: BilingualExplanation;
  /** Short variant-specific justification. Not shown as a hint during play. */
  variantNote: { fr: string; en: string };
  active: boolean;
  source?: PositionSource;
  tags: string[];
  variantGroup?: string;
};

export type TheoreticalTheme = {
  id: TheoreticalThemeId;
  titleKey: string;
  category: 'elementary-mate' | 'pawn' | 'rook';
  iconKey: 'defendsNulle' | 'construisOuverture' | 'jouerLeCoup';
};

export type AttemptOutcome =
  | 'success'
  | 'theoretical-loss'
  | 'abandoned'
  | 'interrupted'
  | 'in-progress';

export type ScoreScaleId = 'legacy-10' | 'quality-5';

export type OfficialEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fifty'
  | 'insufficient'
  | 'position-defended';

export type FirstTheoreticalLoss = {
  playerMoveNumber: number;
  san: string;
  fenBefore: string;
  fenAfter: string;
  expectedResult: TheoreticalObjective;
  resultAfter: 'WIN' | 'DRAW' | 'LOSS';
  message: string;
};

export type QualityGrade = {
  scale: 'quality-5';
  version: 'theoretical-quality-v1';
  /** null = not graded (abandon, interruption, or missing quality data). */
  score: number | null;
  reason:
    | 'failed'
    | 'abandoned'
    | 'interrupted'
    | 'unevaluated'
    | 'mate-distance'
    | 'mechanism'
    | 'draw-without-mechanism';
  /** Measured detours (user moves beyond exact DTM, or mechanism slack). */
  extra: number | null;
  commentFr: string;
  commentEn: string;
};

export type TheoreticalAttemptResult = {
  outcome: AttemptOutcome;
  positionId: string;
  themeId: TheoreticalThemeId;
  objective: TheoreticalObjective;
  objectiveKind: ObjectiveKind;
  playerColor: PlayerColor;
  /** Moves played by the user. Not plies and not full-move pairs. */
  userMoves: number;
  scoreScale: ScoreScaleId;
  /** Null when the attempt has no grade. Never a fabricated 5. */
  attemptScore: number | null;
  quality: QualityGrade | null;
  /** Wall-clock statistic only. Not an input of the grade. */
  durationMs: number;
  firstTheoreticalLoss: FirstTheoreticalLoss | null;
  startFen: string;
  endFen: string;
  moveSans: string[];
  officialEndReason?: OfficialEndReason;
  officialResultMessage?: string | null;
  finishedAt: string;
  offScore: boolean;
};

export type CatalogViewMode = 'cards' | 'list';

export const THEORETICAL_ENDGAME_CONFIG = {
  thinkTimeMs: 1000,
  confirmThinkMs: 1500,
  scoreWindow: 10,
  wdlLossThreshold: 700,
  wdlDrawThreshold: 700,
  /**
   * Safety stop so a fortress cannot run forever.
   * It is not a pedagogical target and must not be shown as one.
   * Hitting it does not score 0.
   */
  technicalUserMoveCap: 80,
  datasetVersion: '2.0.0',
  contentVersion: 'variants-v2',
  scoreVersion: 'theoretical-quality-v1',
  expectedActiveCount: 57,
} as const;
