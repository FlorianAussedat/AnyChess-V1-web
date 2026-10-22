/** Safe, allowlisted diagnostics: never log raw exceptions, bodies, URLs or owner keys. */
export type CloudErrorKind =
  | 'local_size_limit'
  | 'local_quota'
  | 'local_storage'
  | 'schema_missing'
  | 'schema_revision_missing'
  | 'sync_conflict'
  | 'session_expired'
  | 'remote_permission'
  | 'remote_service'
  | 'offline'
  | 'unexpected';
export class CloudOperationError extends Error {
  readonly kind: CloudErrorKind;
  readonly stage: string;
  readonly domain: 'local' | 'remote';
  readonly httpStatus?: number;
  readonly serverCode?: string;
  constructor(
    kind: CloudErrorKind,
    stage: string,
    domain: 'local' | 'remote',
    httpStatus?: number,
    serverCode?: string,
  ) {
    super(kind);
    this.name = 'CloudOperationError';
    this.kind = kind;
    this.stage = stage;
    this.domain = domain;
    this.httpStatus = httpStatus;
    this.serverCode = serverCode;
  }
}
export function classifyCloudError(error: unknown, domain: 'local' | 'remote'): CloudErrorKind {
  if (error instanceof CloudOperationError) return error.kind;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (domain === 'local') {
    if (/CursorWindow|row too big|too large|too big|SQLITE_TOOBIG/i.test(message))
      return 'local_size_limit';
    if (/SQLITE_FULL|database or disk is full|quota|disk full/i.test(message)) return 'local_quota';
    return 'local_storage';
  }
  if (message === 'sync_conflict') return 'sync_conflict';
  if (message === 'schema_missing') return 'schema_missing';
  if (message === 'session_expired') return 'session_expired';
  return /network|fetch|offline|timeout/i.test(message) ? 'offline' : 'unexpected';
}
export function reportCloudError(
  stage: string,
  domain: 'local' | 'remote',
  error: unknown,
): CloudOperationError {
  const safe =
    error instanceof CloudOperationError
      ? error
      : new CloudOperationError(classifyCloudError(error, domain), stage, domain);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[AnyChess cloud]', {
      stage,
      domain: safe.domain,
      kind: safe.kind,
      errorType:
        error instanceof TypeError ? 'TypeError' : error instanceof Error ? 'Error' : 'Unknown',
      ...(safe.httpStatus == null ? {} : { httpStatus: safe.httpStatus }),
      ...(safe.serverCode == null ? {} : { serverCode: safe.serverCode }),
    });
  }
  return safe;
}
export async function cloudStep<T>(
  stage: string,
  domain: 'local' | 'remote',
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw reportCloudError(stage, domain, error);
  }
}
