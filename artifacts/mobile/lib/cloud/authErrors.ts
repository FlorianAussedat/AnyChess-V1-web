import type { CloudAuthError, CloudAuthResult } from './types.ts';

export type { CloudAuthError };

type AuthBody = {
  code?: unknown;
  error_code?: unknown;
  error?: unknown;
  error_description?: unknown;
  msg?: unknown;
  message?: unknown;
  access_token?: unknown;
  refresh_token?: unknown;
  id?: unknown;
  email?: unknown;
  user?: { id?: unknown; email?: unknown } | null;
};

function asBody(body: unknown): AuthBody {
  return body && typeof body === 'object' ? (body as AuthBody) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Prefer GoTrue `error_code`. Numeric `code` (400, 422, 429) is only the HTTP status. */
export function readAuthErrorCode(body: unknown): string {
  const row = asBody(body);
  const coded = text(row.error_code);
  if (coded) return coded;
  const error = text(row.error);
  if (error && !/^\d+$/.test(error)) return error;
  const code = text(row.code);
  if (code && !/^\d+$/.test(code)) return code;
  return '';
}

export function readAuthErrorMessage(body: unknown): string {
  const row = asBody(body);
  return text(row.msg) || text(row.message) || text(row.error_description) || text(row.error);
}

export function readAuthSession(body: unknown): {
  userId: string | null;
  email: string | null;
  accessToken: string | null;
  refreshToken: string | null;
} {
  const row = asBody(body);
  const nested = row.user && typeof row.user === 'object' ? row.user : null;
  const userId = text(nested?.id) || text(row.id) || null;
  const email = text(nested?.email) || text(row.email) || null;
  const accessToken = text(row.access_token) || null;
  const refreshToken = text(row.refresh_token) || null;
  return { userId, email, accessToken, refreshToken };
}

/** Signup accepted, session withheld until the address is confirmed. */
export function isPendingEmailConfirmation(status: number, body: unknown): boolean {
  if (status < 200 || status >= 300) return false;
  const session = readAuthSession(body);
  return Boolean(session.userId) && !session.accessToken;
}

export function retryAfterSecondsFromMessage(message: string): number | undefined {
  const match = message.match(/(\d+)\s*(?:seconds|secondes|s)\b/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function identityCount(body: unknown): number | null {
  const row = asBody(body) as AuthBody & { identities?: unknown };
  if (!Array.isArray(row.identities)) return null;
  return row.identities.length;
}

function confirmationSentAt(body: unknown): string {
  const row = asBody(body) as AuthBody & { confirmation_sent_at?: unknown };
  return text(row.confirmation_sent_at);
}

/**
 * A 200 without an error is not proof that Supabase sent mail.
 * Empty `identities` is the intentional hidden-account response.
 * An explicit error code is the only signal that the address is taken.
 */
export function classifySignupResponse(
  status: number,
  body: unknown,
):
  | { kind: 'session' }
  | { kind: 'confirmation' }
  | { kind: 'ambiguous' }
  | { kind: 'taken' }
  | { kind: 'error'; error: CloudAuthError; retryAfterSeconds?: number } {
  if (status === 0) return { kind: 'error', error: 'offline' };
  const session = readAuthSession(body);
  if (status >= 200 && status < 300 && session.accessToken && session.userId) {
    return { kind: 'session' };
  }
  if (status >= 200 && status < 300 && session.userId && !session.accessToken) {
    const identities = identityCount(body);
    if (identities === 0) return { kind: 'ambiguous' };
    if (confirmationSentAt(body)) return { kind: 'confirmation' };
    if (identities != null && identities > 0) return { kind: 'confirmation' };
    return { kind: 'ambiguous' };
  }
  const mapped = mapSupabaseAuthError(status, body);
  if (mapped.error === 'email_taken') return { kind: 'taken' };
  return {
    kind: 'error',
    error: mapped.error,
    retryAfterSeconds: retryAfterSecondsFromMessage(mapped.message ?? ''),
  };
}

export function mapSupabaseAuthError(status: number, body: unknown): Extract<CloudAuthResult, { ok: false }> {
  const code = readAuthErrorCode(body).toLowerCase();
  const message = readAuthErrorMessage(body);
  const blob = `${code} ${message}`.toLowerCase();

  if (code === 'email_not_confirmed' || /email not confirmed/.test(blob)) {
    return { ok: false, error: 'email_not_confirmed', message };
  }
  if (
    code === 'invalid_credentials' ||
    code === 'invalid_grant' ||
    /invalid login credentials/.test(blob)
  ) {
    return { ok: false, error: 'invalid_credentials', message };
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    /already registered|already exists|user already/.test(blob)
  ) {
    return { ok: false, error: 'email_taken', message };
  }
  if (code === 'weak_password' || (status === 422 && /password/.test(blob))) {
    return { ok: false, error: 'weak_password', message };
  }
  if (code === 'email_address_invalid' || /email address .*invalid|invalid email/.test(blob)) {
    return { ok: false, error: 'email_invalid', message };
  }
  if (
    status === 429 ||
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    /rate limit/.test(blob)
  ) {
    return { ok: false, error: 'rate_limited', message };
  }
  if (status >= 500) return { ok: false, error: 'service_unavailable', message };
  if (status === 401 && /jwt|session|token/.test(blob)) return { ok: false, error: 'session_expired', message };
  if (status === 0) {
    return { ok: false, error: 'offline', message };
  }
  const error: CloudAuthError = 'unexpected';
  return { ok: false, error, message };
}
