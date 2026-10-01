export type AccountProbe = 'exists' | 'gone' | 'unknown';

export type DeletionDecision = 'wipe' | 'keep' | 'keep-pending';

export type DeletionHttp = { status: number; body: string } | 'network';

/**
 * A bare 401 is not proof the account is gone (expired token, wrong password).
 * Only an explicit "user does not exist" body is.
 */
export function classifyAuthProbe(status: number, body: string, networkError: boolean): AccountProbe {
  if (networkError) return 'unknown';
  const text = body.toLowerCase();
  if (
    text.includes('user from sub claim in jwt does not exist') ||
    text.includes('user_not_found') ||
    text.includes('user not found')
  ) {
    return 'gone';
  }
  if (status >= 200 && status < 300) return 'exists';
  return 'unknown';
}

export function decideDeletionOutcome(http: DeletionHttp, probe?: AccountProbe): DeletionDecision {
  if (http === 'network') {
    if (probe === 'gone') return 'wipe';
    if (probe === 'exists') return 'keep';
    return 'keep-pending';
  }
  let parsed: { ok?: boolean; error?: string; alreadyDeleted?: boolean } = {};
  try {
    parsed = JSON.parse(http.body) as typeof parsed;
  } catch {
    parsed = {};
  }
  if (http.status >= 200 && http.status < 300 && parsed.ok === true) return 'wipe';
  if (parsed.error === 'reauth_failed' || parsed.error === 'reauth_required') return 'keep';
  const bodyProbe = classifyAuthProbe(http.status, http.body, false);
  if (bodyProbe === 'gone' || parsed.alreadyDeleted === true) return 'wipe';
  if (http.status >= 500 || http.status === 0) {
    if (probe === 'gone') return 'wipe';
    if (probe === 'exists') return 'keep';
    return 'keep-pending';
  }
  return 'keep';
}

export function deletionErrorCode(decision: DeletionDecision, http: DeletionHttp): string | null {
  if (decision === 'wipe') return null;
  if (http !== 'network') {
    try {
      const parsed = JSON.parse(http.body) as { error?: string };
      if (parsed.error === 'reauth_failed' || parsed.error === 'reauth_required') {
        return 'reauth_failed';
      }
    } catch {
      // fall through
    }
  }
  if (decision === 'keep-pending') return 'offline';
  return 'failed';
}
