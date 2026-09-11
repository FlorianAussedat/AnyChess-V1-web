/**
 * Theoretical endgame training — pure domain types.
 */
export type PlayerColor = 'white' | 'black';

export type TheoreticalObjective = 'WIN' | 'DRAW';

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
  | 'philidor';

export type CompletionRule =
  | { type: 'CHECKMATE' }
  | { type: 'OFFICIAL_GAME_RESULT' };

export type PositionCertification =
  | { type: 'SYZYGY'; result: TheoreticalObjective }
  | { type: 'ENGINE'; engine: string; depth: number; result: TheoreticalObjective };

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
  completion: CompletionRule;
  /** Target player moves for comprehension scoring. */
  targetUserMoves: number;
  certification: PositionCertification;
  /** Board orientation for diagrams (usually matches playerColor). */
  diagramOrientation: PlayerColor;
  explanation: BilingualExplanation;
  /** When false, excluded from runtime selectors (future multi-position themes). */
  active: boolean;
  source?: PositionSource;
  tags: string[];
  /** Optional variant group for color/transform siblings. */
  variantGroup?: string;
};

export type TheoreticalTheme = {
  id: TheoreticalThemeId;
  /** i18n key suffix under quiz.theoreticalTheme* */
  titleKey: string;
  category: 'elementary-mate' | 'pawn' | 'rook';
  /** Placeholder icon key in BrandAssets.exercises */
  iconKey: 'defendsNulle' | 'construisOuverture' | 'jouerLeCoup';
};

export type AttemptOutcome =
  | 'success'
  | 'theoretical-loss'
  | 'abandoned'
  | 'in-progress';

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

export type TheoreticalAttemptResult = {
  outcome: AttemptOutcome;
  positionId: string;
  themeId: TheoreticalThemeId;
  objective: TheoreticalObjective;
  playerColor: PlayerColor;
  userMoves: number;
  targetUserMoves: number;
  /** Score for this attempt (0–10). */
  attemptScore: number;
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
  /** Rolling window for theme comprehension score. */
  scoreWindow: 10,
  /** WDL threshold (permille) to call a theoretical result lost. */
  wdlLossThreshold: 700,
  wdlDrawThreshold: 700,
  datasetVersion: '2.0.0',
  contentVersion: 'canonical-10-v1',
  expectedActiveCount: 10,
} as const;
