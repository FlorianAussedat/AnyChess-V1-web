import {
  isPendingEmailConfirmation,
  mapSupabaseAuthError,
  readAuthSession,
} from './authErrors.ts';
import {
  authConfirmRedirectUrl,
  isSupabaseConfigured,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from './supabaseConfig.ts';
import type {
  CloudAuth,
  CloudAuthResult,
  CloudDocument,
  CloudRemote,
  CloudSession,
  CloudUser,
} from './types.ts';

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

export class SupabaseCloudAuth implements CloudAuth {
  private accessToken: string | null = null;
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
    const saved = (await this.persist?.load()) ?? null;
    if (!saved) return null;
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

  async signUp(email: string, password: string): Promise<CloudAuthResult> {
    return this.postAuth('/auth/v1/signup', { email, password }, authConfirmRedirectUrl());
  }

  async signIn(email: string, password: string): Promise<CloudAuthResult> {
    return this.postAuth('/auth/v1/token?grant_type=password', { email, password });
  }

  async signOut(): Promise<void> {
    const url = resolveSupabaseUrl();
    if (url && this.accessToken) {
      try {
        await fetch(`${url}/auth/v1/logout`, {
          method: 'POST',
          headers: headers(this.accessToken),
        });
      } catch {
        // local sign-out still proceeds
      }
    }
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    await this.persist?.save(null);
  }

  async resendSignupConfirmation(email: string): Promise<{ ok: boolean; error?: CloudAuthResult['error'] }> {
    const url = resolveSupabaseUrl();
    if (!url || !this.configured) return { ok: false, error: 'unconfigured' };
    const redirect = authConfirmRedirectUrl();
    const target = `${url}/auth/v1/resend${
      redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''
    }`;
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email, type: 'signup' }),
      });
      const json = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true };
      return { ok: false, error: mapSupabaseAuthError(response.status, json).error };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  async recoverPassword(email: string): Promise<{ ok: boolean; error?: CloudAuthResult['error'] }> {
    const url = resolveSupabaseUrl();
    if (!url || !this.configured) return { ok: false, error: 'unconfigured' };
    const redirect = authConfirmRedirectUrl();
    const target = `${url}/auth/v1/recover${
      redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''
    }`;
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email }),
      });
      if (response.ok) return { ok: true };
      const json = await response.json().catch(() => ({}));
      return { ok: false, error: mapSupabaseAuthError(response.status, json).error };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  async refreshSession(): Promise<boolean> {
    const url = resolveSupabaseUrl();
    if (!url || !this.refreshToken) return false;
    try {
      const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      const json = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        user?: { id?: string; email?: string };
      };
      if (!response.ok || !json.access_token || !json.user?.id) return false;
      const user = { id: json.user.id, email: json.user.email ?? this.user?.email ?? '' };
      this.accessToken = json.access_token;
      this.refreshToken = json.refresh_token ?? this.refreshToken;
      this.user = user;
      await this.persist?.save({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken ?? undefined,
        user,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async postAuth(
    path: string,
    body: { email: string; password: string },
    redirectTo?: string | null,
  ): Promise<CloudAuthResult> {
    const url = resolveSupabaseUrl();
    if (!url || !this.configured) return { ok: false, error: 'unconfigured' };
    const join = path.includes('?') ? '&' : '?';
    const target = `${url}${path}${
      redirectTo ? `${join}redirect_to=${encodeURIComponent(redirectTo)}` : ''
    }`;
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      if (isPendingEmailConfirmation(response.status, json)) {
        return {
          ok: false,
          error: 'confirm_email',
          email: readAuthSession(json).email ?? body.email,
        };
      }
      const session = readAuthSession(json);
      if (!response.ok || !session.accessToken || !session.userId) {
        return mapSupabaseAuthError(response.status, json);
      }
      const user = { id: session.userId, email: session.email ?? body.email };
      this.accessToken = session.accessToken;
      this.refreshToken = session.refreshToken;
      this.user = user;
      await this.persist?.save({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? undefined,
        user,
      });
      return { ok: true, user };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }
}

export class SupabaseCloudRemote implements CloudRemote {
  private readonly auth: SupabaseCloudAuth;

  constructor(auth: SupabaseCloudAuth) {
    this.auth = auth;
  }

  private async authorizedFetch(url: string, init: RequestInit, retried = false): Promise<Response> {
    const token = this.auth.token();
    if (!token) throw new Error('unconfigured');
    const response = await fetch(url, {
      ...init,
      headers: { ...headers(token), ...(init.headers as Record<string, string> | undefined) },
    });
    if (response.status === 401 && !retried && (await this.auth.refreshSession())) {
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
      throw new Error(`list ${response.status}`);
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
      `${url}/rest/v1/user_documents?on_conflict=user_id,doc_key`,
      {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates',
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
      throw new Error(`upsert ${response.status}`);
    }
  }
}
