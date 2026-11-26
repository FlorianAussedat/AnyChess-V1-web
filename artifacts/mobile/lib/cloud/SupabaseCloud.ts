import { classifyAuthProbe, type AccountProbe } from './deletionDecision.ts';
import { authRequest, AuthTimeoutError, validAuthEmail } from './authRequest.ts';
import {
  classifySignupResponse,
  isPendingEmailConfirmation,
  mapSupabaseAuthError,
  readAuthSession,
  retryAfterSecondsFromMessage,
} from './authErrors.ts';
import {
  authConfirmRedirectUrl,
  authMailLanguage,
  isSupabaseConfigured,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from './supabaseConfig.ts';
import type {
  CloudAuth,
  AuthAttemptOptions,
  CloudAuthError,
  CloudAuthResult,
  CloudDocument,
  CloudRemote,
  CloudSession,
  CloudUser,
} from './types.ts';

/**
 * Language stored on the new account (`raw_user_meta_data.language`).
 * Later auth emails read `{{ .Data.language }}`. French if preferences
 * are not loaded yet. This does not read or send a confirmation token.
 */
async function readAuthEmailLanguage(): Promise<'fr' | 'en'> {
  try {
    const mod = await import('../preferences/PreferencesStore.ts');
    await mod.preferencesStore.ensureLoaded();
    return authMailLanguage(mod.preferencesStore.getPreferences().language);
  } catch {
    return 'fr';
  }
}

function headers(accessToken?: string): Record<string, string> {
  const anon = resolveSupabaseAnonKey() ?? '';
  const out: Record<string, string> = {
    apikey: anon,
    'Content-Type': 'application/json',
  };
  if (accessToken) out.Authorization = `Bearer ${accessToken}`;
  else out.Authorization = `Bearer ${anon}`;
  return out;
}

/** Best-effort server revoke. Never blocks the local sign-out. */
function forgetRemoteSession(url: string, token: string): void {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const handle = timer as unknown as { unref?: () => void };
  handle.unref?.();
  void fetch(`${url}/auth/v1/logout`, {
    method: 'POST',
    headers: headers(token),
    signal: controller.signal,
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

export class SupabaseCloudAuth implements CloudAuth {
  readonly localSignOutOnly = true;
  private accessToken: string | null = null;
  private generation = 0;
  private refreshFlight: Promise<boolean> | null = null;
  private refreshGeneration = 0;
  private sessionWrites: Promise<unknown> = Promise.resolve();
  private refreshToken: string | null = null;
  private user: CloudUser | null = null;
  private readonly persist?: {
    load(): Promise<CloudSession | null>;
    save(session: CloudSession | null): Promise<void>;
  };

  constructor(persist?: {
    load(): Promise<CloudSession | null>;
    save(session: CloudSession | null): Promise<void>;
  }) {
    this.persist = persist;
  }

  get configured(): boolean {
    return isSupabaseConfigured();
  }

  async hydrate(): Promise<CloudUser | null> {
    const generation = ++this.generation;
    await this.sessionWrites.catch(() => undefined);
    const saved = (await this.persist?.load()) ?? null;
    if (generation !== this.generation) return this.user;
    if (
      !saved ||
      !saved.accessToken?.trim() ||
      !saved.user?.id ||
      typeof saved.user.email !== 'string'
    )
      return null;
    this.accessToken = saved.accessToken;
    this.refreshToken = saved.refreshToken ?? null;
    this.user = saved.user;
    return saved.user;
  }

  token(): string | null {
    return this.accessToken;
  }

  async getUser(): Promise<CloudUser | null> {
    return this.user;
  }

  async signUp(
    email: string,
    password: string,
    options?: AuthAttemptOptions,
  ): Promise<CloudAuthResult> {
    const generation = ++this.generation;
    const language = await readAuthEmailLanguage();
    return this.postAuth(
      '/auth/v1/signup',
      { email, password },
      authConfirmRedirectUrl(language),
      { language },
      'signup',
      options,
      generation,
    );
  }

  async signIn(
    email: string,
    password: string,
    options?: AuthAttemptOptions,
  ): Promise<CloudAuthResult> {
    const generation = ++this.generation;
    return this.postAuth(
      '/auth/v1/token?grant_type=password',
      { email, password },
      null,
      undefined,
      'password',
      options,
      generation,
    );
  }

  async signOut(): Promise<void> {
    ++this.generation;
    const url = resolveSupabaseUrl();
    const token = this.accessToken;
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    if (url && token) forgetRemoteSession(url, token);
    await this.writeSession(null);
  }

  private writeSession(
    session: CloudSession | null,
    current: () => boolean = () => true,
  ): Promise<void> {
    const write = this.sessionWrites
      .catch(() => {})
      .then(async () => {
        if (!current()) return;
        const previous = (await this.persist?.load()) ?? null;
        if (!current()) return;
        await this.persist?.save(session);
        // Compensate inside this queue before a newer session can commit.
        if (!current()) await this.persist?.save(previous);
      });
    this.sessionWrites = write;
    return write;
  }

  async resendSignupConfirmation(email: string): Promise<{ ok: boolean; error?: CloudAuthError }> {
    if (!validAuthEmail(email)) return { ok: false, error: 'email_invalid' };
    const url = resolveSupabaseUrl();
    if (!url || !this.configured) return { ok: false, error: 'unconfigured' };
    const language = await readAuthEmailLanguage();
    const redirect = authConfirmRedirectUrl(language);
    const target = `${url}/auth/v1/resend${
      redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''
    }`;
    try {
      const { response, json } = await authRequest(async (signal) => {
        const response = await fetch(target, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ email, type: 'signup' }),
          signal,
        });
        return { response, json: await response.json().catch(() => ({})) };
      });
      if (response.ok) return { ok: true };
      return { ok: false, error: mapSupabaseAuthError(response.status, json).error };
    } catch (error) {
      return { ok: false, error: error instanceof AuthTimeoutError ? 'timeout' : 'offline' };
    }
  }

  async recoverPassword(email: string): Promise<{ ok: boolean; error?: CloudAuthError }> {
    if (!validAuthEmail(email)) return { ok: false, error: 'email_invalid' };
    const url = resolveSupabaseUrl();
    if (!url || !this.configured) return { ok: false, error: 'unconfigured' };
    const language = await readAuthEmailLanguage();
    const redirect = authConfirmRedirectUrl(language);
    const target = `${url}/auth/v1/recover${
      redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''
    }`;
    try {
      const { response, json } = await authRequest(async (signal) => {
        const response = await fetch(target, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ email }),
          signal,
        });
        return { response, json: await response.json().catch(() => ({})) };
      });
      if (response.ok) return { ok: true };
      return { ok: false, error: mapSupabaseAuthError(response.status, json).error };
    } catch (error) {
      return { ok: false, error: error instanceof AuthTimeoutError ? 'timeout' : 'offline' };
    }
  }

  async probeAccount(): Promise<AccountProbe> {
    const url = resolveSupabaseUrl();
    const owner = this.user?.id;
    const generation = this.generation;
    if (!url || !owner || !this.accessToken) return 'unknown';
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const token = this.accessToken;
        const { response, body } = await authRequest(async (signal) => {
          const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
            headers: headers(token ?? undefined),
            signal,
          });
          return { response, body: await response.text() };
        });
        if (generation !== this.generation || this.user?.id !== owner) return 'unknown';
        const verdict = classifyAuthProbe(response.status, body, false);
        if (verdict === 'gone') return verdict;
        if (response.ok) {
          const row = JSON.parse(body);
          return row.id === owner ? 'exists' : 'unknown';
        }
        if (response.status !== 401 || attempt !== 0 || !(await this.refreshSession()))
          return 'unknown';
      }
    } catch {
      /* A failed probe never authorizes a wipe. */
    }
    return 'unknown';
  }

  refreshSession(): Promise<boolean> {
    if (this.refreshFlight && this.refreshGeneration === this.generation) return this.refreshFlight;
    this.refreshGeneration = this.generation;
    const work = this.refreshSessionOnce();
    const wrapped = work.finally(() => {
      if (this.refreshFlight === wrapped) this.refreshFlight = null;
    });
    this.refreshFlight = wrapped;
    return wrapped;
  }

  private async refreshSessionOnce(): Promise<boolean> {
    const url = resolveSupabaseUrl();
    if (!url || !this.refreshToken) return false;
    const originalToken = this.accessToken;
    const originalRefresh = this.refreshToken;
    try {
      const { response, json } = await authRequest(async (signal) => {
        const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ refresh_token: originalRefresh }),
          signal,
        });
        const json = (await response.json()) as {
          access_token?: string;
          refresh_token?: string;
          user?: { id?: string; email?: string };
        };
        return { response, json };
      });
      if (this.accessToken !== originalToken || this.refreshToken !== originalRefresh) return false;
      if (!response.ok || !json.access_token || !json.user?.id) return false;
      const user = { id: json.user.id, email: json.user.email ?? this.user?.email ?? '' };
      const current = () =>
        this.accessToken === originalToken && this.refreshToken === originalRefresh;
      await this.writeSession(
        {
          accessToken: json.access_token,
          refreshToken: json.refresh_token ?? originalRefresh,
          user,
        },
        current,
      );
      if (!current()) return false;
      this.accessToken = json.access_token;
      this.refreshToken = json.refresh_token ?? originalRefresh;
      this.user = user;
      return true;
    } catch {
      return false;
    }
  }

  private async postAuth(
    path: string,
    body: { email: string; password: string },
    redirectTo?: string | null,
    data?: { language: 'fr' | 'en' },
    intent: 'signup' | 'password' = 'password',
    options?: AuthAttemptOptions,
    generation = this.generation,
  ): Promise<CloudAuthResult> {
    const url = resolveSupabaseUrl();
    if (!url || !this.configured) return { ok: false, error: 'unconfigured' };
    if (!validAuthEmail(body.email)) return { ok: false, error: 'email_invalid' };
    if (!body.password || (intent === 'signup' && body.password.length < 6))
      return { ok: false, error: 'weak_password' };
    const originalSession: CloudSession | null =
      this.accessToken && this.user
        ? {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken ?? undefined,
            user: this.user,
          }
        : null;
    const current = () => generation === this.generation && !options?.abandoned?.();
    if (!current()) return { ok: false, error: 'unexpected' };
    const join = path.includes('?') ? '&' : '?';
    const target = `${url}${path}${
      redirectTo ? `${join}redirect_to=${encodeURIComponent(redirectTo)}` : ''
    }`;
    const payload = data ? { ...body, data } : body;
    try {
      const { response, json } = await authRequest(async (signal) => {
        const response = await fetch(target, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(payload),
          signal,
        });
        return { response, json: await response.json().catch(() => ({})) };
      });
      if (!current()) return { ok: false, error: 'unexpected' };
      if (intent === 'signup') {
        const classified = classifySignupResponse(response.status, json);
        const email = readAuthSession(json).email ?? body.email;
        if (classified.kind === 'ambiguous') {
          return { ok: false, error: 'signup_ambiguous', email };
        }
        if (classified.kind === 'confirmation') {
          return {
            ok: false,
            error: 'confirm_email',
            email,
            pendingUserId: readAuthSession(json).userId ?? undefined,
          };
        }
        if (classified.kind === 'taken') return { ok: false, error: 'email_taken', email };
        if (classified.kind === 'error') {
          return {
            ok: false,
            error: classified.error,
            email,
            retryAfterSeconds: classified.retryAfterSeconds,
          };
        }
      } else if (isPendingEmailConfirmation(response.status, json)) {
        return {
          ok: false,
          error: 'confirm_email',
          email: readAuthSession(json).email ?? body.email,
        };
      }
      const session = readAuthSession(json);
      if (!response.ok || !session.accessToken || !session.userId) {
        const mapped = mapSupabaseAuthError(response.status, json);
        return {
          ...mapped,
          retryAfterSeconds: retryAfterSecondsFromMessage(mapped.message ?? ''),
        };
      }
      const user = { id: session.userId, email: session.email ?? body.email };
      try {
        await this.writeSession(
          {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken ?? undefined,
            user,
          },
          current,
        );
      } catch {
        return { ok: false, error: 'local_save_failed' };
      }
      if (!current()) {
        if (generation === this.generation)
          await this.writeSession(originalSession, () => generation === this.generation);
        return { ok: false, error: 'unexpected' };
      }
      this.accessToken = session.accessToken;
      this.refreshToken = session.refreshToken;
      this.user = user;
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: error instanceof AuthTimeoutError ? 'timeout' : 'offline' };
    }
  }
}

export class SupabaseCloudRemote implements CloudRemote {
  private readonly auth: SupabaseCloudAuth;

  constructor(auth: SupabaseCloudAuth) {
    this.auth = auth;
  }

  private async authorizedFetch(
    url: string,
    init: RequestInit,
    retried = false,
  ): Promise<Response> {
    const token = this.auth.token();
    if (!token) throw new Error('unconfigured');
    const response = await fetch(url, {
      ...init,
      headers: { ...headers(token), ...(init.headers as Record<string, string> | undefined) },
    });
    if (
      response.status === 401 &&
      !retried &&
      this.auth.token() === token &&
      (await this.auth.refreshSession())
    ) {
      return this.authorizedFetch(url, init, true);
    }
    return response;
  }

  async listDocuments(userId: string): Promise<CloudDocument[]> {
    const url = resolveSupabaseUrl();
    if (!url) return [];
    const response = await this.authorizedFetch(
      `${url}/rest/v1/user_documents?user_id=eq.${encodeURIComponent(userId)}&select=doc_key,payload,updated_at,deleted_at,revision`,
      { method: 'GET' },
    );
    const body = await response.text();
    if (!response.ok) {
      if (response.status === 404 && /user_documents/i.test(body)) {
        throw new Error('schema_missing');
      }
      throw new Error(response.status === 401 ? 'session_expired' : `list ${response.status}`);
    }
    const rows = JSON.parse(body || '[]') as {
      doc_key: string;
      payload: unknown;
      updated_at: string;
      deleted_at: string | null;
      revision: number;
    }[];
    return rows
      .filter((row) => !row.deleted_at)
      .map((row) => ({
        docKey: row.doc_key,
        payload: typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload),
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        revision: row.revision ?? 1,
      }));
  }

  async upsertDocument(userId: string, doc: CloudDocument): Promise<void> {
    const url = resolveSupabaseUrl();
    if (!url) throw new Error('unconfigured');
    const response = await this.authorizedFetch(
      doc.revision <= 1
        ? `${url}/rest/v1/user_documents?on_conflict=user_id,doc_key`
        : `${url}/rest/v1/user_documents?user_id=eq.${encodeURIComponent(userId)}&doc_key=eq.${encodeURIComponent(doc.docKey)}&revision=eq.${doc.revision - 1}`,
      {
        method: doc.revision <= 1 ? 'POST' : 'PATCH',
        headers: {
          Prefer:
            doc.revision <= 1
              ? 'resolution=ignore-duplicates,return=representation'
              : 'return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          doc_key: doc.docKey,
          payload: doc.payload ? JSON.parse(doc.payload) : null,
          updated_at: doc.updatedAt,
          deleted_at: doc.deletedAt,
          revision: doc.revision,
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      if (response.status === 404 && /user_documents/i.test(body)) {
        throw new Error('schema_missing');
      }
      throw new Error(response.status === 401 ? 'session_expired' : `upsert ${response.status}`);
    }
    const rows = (await response.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('sync_conflict');
  }
}
