import type { CloudAuthError, CloudAuthResult } from './types.ts';

type AuthBody = {
  code?: unknown;
  error_code?: unknown;
  error?: unknown;
  error_description?: unknown;
  msg?: unknown;
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
  return text(row.msg) || text(row.error_description) || text(row.error);
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
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return { ok: false, error: 'offline', message };
  }
  const error: CloudAuthError = 'unexpected';
  return { ok: false, error, message };
}
