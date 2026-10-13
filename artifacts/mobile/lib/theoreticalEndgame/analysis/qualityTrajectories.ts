/**
 * Recorded complete trajectories at several quality levels.
 *
 * Automated engine-best play is one protocol. These lines are another: they
 * stay legal end-to-end, and the grade must separate an efficient realisation
 * from the same objective with detours. More scores are not enough.
 */
import type { TheoreticalThemeId } from '../domain/types.ts';

export type TrajectoryQuality = 'efficient' | 'detour';

export type RecordedTrajectory = {
  id: string;
  themeId: TheoreticalThemeId;
  positionId: string;
  quality: TrajectoryQuality;
  sans: string[];
  /** Expected quality-5 band when the protocol can measure this line. */
  expectedScore?: number;
};

export const QUALITY_TRAJECTORIES: readonly RecordedTrajectory[] = [
  {
    id: 'queen-mate-in-one-efficient',
    themeId: 'queen-mate',
    positionId: 'TE-ENGINE-QUEEN',
    quality: 'efficient',
    sans: ['Qg7#'],
    expectedScore: 5,
  },
  {
    id: 'queen-mate-in-one-detour',
    themeId: 'queen-mate',
    positionId: 'TE-ENGINE-QUEEN',
    quality: 'detour',
    sans: ['Qg2', 'Kh7', 'Qg7#'],
  },
  {
    id: 'two-bishops-short-efficient',
    themeId: 'two-bishops-mate',
    positionId: 'TE-ENGINE-BISHOPS',
    quality: 'efficient',
    sans: ['Be4', 'Kh8', 'Bd5', 'Kh7', 'Be3', 'Kh8', 'Kf7', 'Kh7', 'Be4+', 'Kh8', 'Bd4#'],
  },
  {
    id: 'two-bishops-short-detour',
    themeId: 'two-bishops-mate',
    positionId: 'TE-ENGINE-BISHOPS',
    quality: 'detour',
    sans: [
      'Bh3',
      'Kh8',
      'Bg2',
      'Kg8',
      'Be4',
      'Kh8',
      'Bd5',
      'Kh7',
      'Be3',
      'Kh8',
      'Kf7',
      'Kh7',
      'Be4+',
      'Kh8',
      'Bd4#',
    ],
  },
  {
    id: 'rook-mate-in-one-efficient',
    themeId: 'rook-mate',
    positionId: 'TE-ENGINE-ROOK',
    quality: 'efficient',
    sans: ['Ra8#'],
    expectedScore: 5,
  },
  {
    id: 'philidor-barrier-efficient',
    themeId: 'philidor',
    positionId: 'TE-CANON-PHILIDOR',
    quality: 'efficient',
    sans: ['Rc6'],
    expectedScore: 5,
  },
  {
    id: 'philidor-2-barrier-efficient',
    themeId: 'philidor',
    positionId: 'TE-CANON-PHILIDOR-2',
    quality: 'efficient',
    sans: ['Rb6'],
    expectedScore: 5,
  },
  {
    id: 'philidor-3-king-in-front',
    themeId: 'philidor',
    positionId: 'TE-CANON-PHILIDOR-3',
    quality: 'efficient',
    sans: ['Ke7'],
    expectedScore: 5,
  },
  {
    id: 'philidor-slack-detour',
    themeId: 'philidor',
    positionId: 'TE-CANON-PHILIDOR',
    quality: 'detour',
    sans: ['Kf8', 'Ra8+', 'Rb8'],
  },
  {
    id: 'vancura-lateral-efficient',
    themeId: 'vancura',
    positionId: 'TE-CANON-VANCURA-1',
    quality: 'efficient',
    sans: ['Rc5'],
    expectedScore: 5,
  },
  {
    id: 'vancura-2-rank-efficient',
    themeId: 'vancura',
    positionId: 'TE-CANON-VANCURA-2',
    quality: 'efficient',
    sans: ['Rc4'],
    expectedScore: 5,
  },
  {
    id: 'vancura-3-hold-efficient',
    themeId: 'vancura',
    positionId: 'TE-CANON-VANCURA-3',
    quality: 'efficient',
    sans: ['Kg7'],
    expectedScore: 5,
  },
  {
    id: 'vancura-slack-detour',
    themeId: 'vancura',
    positionId: 'TE-CANON-VANCURA-1',
    quality: 'detour',
    sans: ['Rc5', 'a6', 'Rc7'],
  },
  {
    id: 'pawn-square-enter-efficient',
    themeId: 'pawn-square',
    positionId: 'TE-CANON-PAWN-SQUARE-D1',
    quality: 'efficient',
    sans: ['Kg7'],
    expectedScore: 5,
  },
  {
    id: 'pawn-square-d2-enter',
    themeId: 'pawn-square',
    positionId: 'TE-CANON-PAWN-SQUARE-D2',
    quality: 'efficient',
    sans: ['Kc7', 'd3', 'Kd8'],
    expectedScore: 5,
  },
  {
    id: 'rook-pawn-corner-efficient',
    themeId: 'rook-pawn',
    positionId: 'TE-CANON-ROOK-PAWN-DEF-H',
    quality: 'efficient',
    sans: ['Kh8'],
    expectedScore: 5,
  },
  {
    id: 'rook-pawn-a-corner',
    themeId: 'rook-pawn',
    positionId: 'TE-CANON-ROOK-PAWN-DEF-A',
    quality: 'efficient',
    sans: ['Kb8', 'Kc6', 'Ka7'],
  },
  {
    id: 'bad-bishop-corner-efficient',
    themeId: 'bad-bishop',
    positionId: 'TE-CANON-BAD-BISHOP-1',
    quality: 'efficient',
    sans: ['Kg8', 'h6', 'Kh8'],
    expectedScore: 5,
  },
  {
    id: 'bad-bishop-2-corner',
    themeId: 'bad-bishop',
    positionId: 'TE-CANON-BAD-BISHOP-2',
    quality: 'efficient',
    sans: ['Ka8'],
    expectedScore: 5,
  },
  {
    id: 'bad-bishop-3-corner',
    themeId: 'bad-bishop',
    positionId: 'TE-CANON-BAD-BISHOP-3',
    quality: 'efficient',
    sans: ['Kh8'],
    expectedScore: 5,
  },
  {
    id: 'lateral-capture-efficient',
    themeId: 'lateral-checks',
    positionId: 'TE-CANON-LATERAL-1',
    quality: 'efficient',
    sans: ['Kf6', 'e5+', 'Kxe5'],
    expectedScore: 5,
  },
  {
    id: 'lateral-2-capture',
    themeId: 'lateral-checks',
    positionId: 'TE-CANON-LATERAL-2',
    quality: 'efficient',
    sans: ['Rh6', 'Ka6', 'Rxc6+'],
  },
  {
    id: 'lateral-3-capture',
    themeId: 'lateral-checks',
    positionId: 'TE-CANON-LATERAL-3',
    quality: 'efficient',
    sans: ['Ra6', 'Kg5', 'Rxg6+'],
  },
];

/** Mate-in-one FENs used only by recorded WIN trajectories (not catalog ids). */
export const RECORDED_START_FEN: Record<string, string> = {
  'TE-ENGINE-QUEEN': '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1',
  'TE-ENGINE-ROOK': '6k1/8/6K1/8/8/8/8/R7 w - - 0 1',
  'TE-ENGINE-BISHOPS': '6k1/8/5K2/8/8/8/5BB1/8 w - - 0 1',
};
