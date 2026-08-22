/**
 * Internal test fixtures — never imported by runtime selectors or UI.
 */
import type { EndgameTrainingPosition } from '../../domain/types.ts';

/** Classic KP vs K draw defence (former DD-001 shape, test-only id). */
export const FIXTURE_KP_VS_K: EndgameTrainingPosition = {
  id: 'FIXTURE-ET-1',
  fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1',
  defender: 'black',
  source: {
    provider: 'test-fixture',
    sourceId: 'FIXTURE-ET-1',
    license: 'internal-test',
    importedAt: '2026-08-22',
  },
  family: 'pawn',
  materialSignature: 'KP-k',
  quality: {
    initialEvaluation: 0,
    validationKind: 'syzygy',
    defensiveMoveCount: 3,
  },
  estimatedDifficulty: 'easy',
  pressureType: 'opposition',
};

/** White-defends pawn race fragment for variety in selector tests. */
export const FIXTURE_PAWN_RACE: EndgameTrainingPosition = {
  id: 'FIXTURE-ET-2',
  fen: '8/1p6/8/8/8/8/1P6/k1K5 w - - 0 1',
  defender: 'white',
  source: {
    provider: 'test-fixture',
    sourceId: 'FIXTURE-ET-2',
    license: 'internal-test',
    importedAt: '2026-08-22',
  },
  family: 'pawn',
  materialSignature: 'KP-kp',
  quality: {
    initialEvaluation: 0,
    validationKind: 'syzygy',
    defensiveMoveCount: 3,
  },
  estimatedDifficulty: 'easy',
  pressureType: 'pawn-race',
};

export const ENDGAME_TEST_FIXTURES: readonly EndgameTrainingPosition[] = [
  FIXTURE_KP_VS_K,
  FIXTURE_PAWN_RACE,
];

/** Legacy runtime ids removed in dataset 2.0.0 — must never reappear in pool.generated.ts */
export const LEGACY_RUNTIME_IDS = [
  'DD-001',
  'DD-002',
  'DD-003',
  'DD-005',
  'DD-006',
  'DD-007',
  'DD-011',
  'DD-013',
  'DD-014',
  'DD-018',
  'DD-020',
  'DD-022',
  'DD-023',
  'DD-046',
  'DD-061',
  'DD-062',
  'DD-085',
  'DD-087',
  'DD-098',
  'DD-103',
  'DD-126',
  'DD-136',
  'DD-153',
  'DD-163',
  'DD-170',
  'DD-180',
  'DD-214',
  'DD-695',
  'DD-705',
  'DD-708',
  'DD-715',
  'DD-732',
  'DD-747',
  'DD-809',
] as const;
