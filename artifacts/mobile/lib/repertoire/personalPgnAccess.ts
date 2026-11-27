/**
 * Personal opening studies belong to a signed-in account.
 * The guard is installed by the app shell. Unit tests that build a
 * RepertoireService directly do not install it.
 */
export class PersonalPgnAccessError extends Error {
  readonly code = 'auth_required' as const;

  constructor(message: string) {
    super(message);
    this.name = 'PersonalPgnAccessError';
  }
}

/**
 * Block personal PGN writes only when an account system is actually available
 * and nobody is signed in. A build without the Supabase client keeps the
 * library that is already on the device usable.
 */
export function personalPgnWritesBlocked(state: {
  sessionReady: boolean;
  user: { id: string } | null;
  status: string;
}): boolean {
  return state.sessionReady && !state.user && state.status !== 'unconfigured';
}

let guard: (() => void) | null = null;

export function installPersonalPgnGuard(next: (() => void) | null): void {
  guard = next;
}

export function assertPersonalPgnWrite(): void {
  guard?.();
}
