import type { MainModeId } from '../app/modes.ts';

export const ACTIVITY_SESSIONS_VERSION = 1 as const;

export type ActivityKind =
  | 'classic'
  | 'opening-play'
  | 'opening-continue'
  | 'opening-study'
  | 'blind'
  | 'puzzles-tactical'
  | 'defends-nulle'
  | 'theoretical-endgame'
  | 'mental'
  | 'nommer'
  | 'jouer'
  | 'quelle'
  | 'culture'
  | 'parties-analyzer';

export type ActivityNoun = 'partie' | 'probleme' | 'quiz' | 'cours' | 'exercice';

export type ActivitySessionRecord = {
  id: string;
  kind: ActivityKind;
  modeId: MainModeId;
  noun: ActivityNoun;
  title: string;
  summary: string;
  route: string;
  updatedAt: number;
  /** False once the attempt is finished / results-only. */
  inProgress: boolean;
  payload: unknown;
};

export type ActivitySessionsDocument = {
  version: typeof ACTIVITY_SESSIONS_VERSION;
  sessions: Record<string, ActivitySessionRecord>;
};

export function createActivitySessionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** User-facing quit copy family — coarser than ActivityNoun. */
export type ActivityEndCopy = 'partie' | 'exercice' | 'analyse' | 'quiz' | 'entrainement';

export function endCopyForKind(kind: ActivityKind): ActivityEndCopy {
  switch (kind) {
    case 'classic':
      return 'partie';
    case 'parties-analyzer':
      return 'analyse';
    case 'quelle':
    case 'culture':
      return 'quiz';
    case 'opening-play':
    case 'opening-study':
    case 'opening-continue':
      return 'entrainement';
    default:
      return 'exercice';
  }
}

export function nounForKind(kind: ActivityKind): ActivityNoun {
  switch (kind) {
    case 'classic':
    case 'opening-play':
    case 'parties-analyzer':
      return 'partie';
    case 'puzzles-tactical':
    case 'defends-nulle':
    case 'theoretical-endgame':
      return 'probleme';
    case 'quelle':
    case 'culture':
      return 'quiz';
    case 'opening-study':
    case 'opening-continue':
      return 'cours';
    default:
      return 'exercice';
  }
}
