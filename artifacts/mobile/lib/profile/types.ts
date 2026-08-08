/**
 * Local-only user profile document.
 * Designed to stay serializable for a future cloud sync layer.
 */
export interface UserProfile {
  version: 1;
  /** Stable local id (not an account id). */
  id: string;
  username: string | null;
  rapidRangeId: string | null;
  blitzRangeId: string | null;
  bulletRangeId: string | null;
  /** Years of chess practice; null = unset. */
  chessYears: number | null;
  updatedAt: string;
}

export type UserProfilePatch = Partial<
  Pick<
    UserProfile,
    'username' | 'rapidRangeId' | 'blitzRangeId' | 'bulletRangeId' | 'chessYears'
  >
>;

export const USER_PROFILE_DOCUMENT_VERSION = 1 as const;

export const CHESS_YEARS_MIN = 0;
export const CHESS_YEARS_MAX = 80;

export function emptyUserProfile(now: () => string = () => new Date().toISOString()): UserProfile {
  return {
    version: USER_PROFILE_DOCUMENT_VERSION,
    id: `local_${Math.random().toString(36).slice(2, 10)}`,
    username: null,
    rapidRangeId: null,
    blitzRangeId: null,
    bulletRangeId: null,
    chessYears: null,
    updatedAt: now(),
  };
}
