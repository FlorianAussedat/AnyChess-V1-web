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

let guard: (() => void) | null = null;

export function installPersonalPgnGuard(next: (() => void) | null): void {
  guard = next;
}

export function assertPersonalPgnWrite(): void {
  guard?.();
}
