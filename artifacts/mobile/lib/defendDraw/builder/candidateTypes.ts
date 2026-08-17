import type { DefendDrawSource } from '../taxonomy.ts';

export type RawCandidate = {
  fen: string;
  defenderColor: 'w' | 'b';
  theme: string;
  label: string;
  source: DefendDrawSource;
  /** Hint for generator — not used at runtime. */
  generatorTag?: string;
};

export type PoolTargets = {
  debutant: number;
  confirme: number;
  expert: number;
  grandMaitre: number;
};

export const DEFAULT_POOL_TARGETS: PoolTargets = {
  debutant: 30,
  confirme: 40,
  expert: 40,
  grandMaitre: 25,
};

export type RejectionReason =
  | 'duplicate-fen'
  | 'invalid-fen'
  | 'game-over'
  | 'certification-failed'
  | 'trivial'
  | 'incoherent-difficulty'
  | 'target-full'
  | 'mirror-duplicate';

export type BuildRejection = {
  fen: string;
  reason: RejectionReason;
  detail: string;
};
