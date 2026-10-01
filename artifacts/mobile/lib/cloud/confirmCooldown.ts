/** Minimum wait between confirmation emails triggered from the app. */
export const CONFIRM_EMAIL_RESEND_COOLDOWN_MS = 60_000;

let lastSentAt = 0;

export function markConfirmationEmailSent(at = Date.now()): void {
  lastSentAt = at;
}

export function confirmationResendWaitSeconds(now = Date.now()): number {
  if (!lastSentAt) return 0;
  const remaining = lastSentAt + CONFIRM_EMAIL_RESEND_COOLDOWN_MS - now;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / 1000);
}

export function resetConfirmationEmailCooldown(): void {
  lastSentAt = 0;
}
