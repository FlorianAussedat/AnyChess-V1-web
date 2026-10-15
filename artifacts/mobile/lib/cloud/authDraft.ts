/** Keeps the typed address when the sign-in and sign-up forms swap. Not persisted. */
let draftEmail = '';

export function setAuthDraftEmail(email: string): void {
  draftEmail = email;
}

export function peekAuthDraftEmail(): string {
  return draftEmail;
}
