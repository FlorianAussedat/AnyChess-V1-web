/**
 * Where to go back after a guest opens the existing sign-in screen.
 * In-memory only: it never touches stored games, preferences, or the session.
 */
let pendingReturn: string | null = null;

export function setAuthReturn(href: string): void {
  const next = href.trim();
  pendingReturn = !next || next === '/utilisateur' || next.startsWith('/profil') ? null : next;
}

export function consumeAuthReturn(): string | null {
  const value = pendingReturn;
  pendingReturn = null;
  return value;
}
