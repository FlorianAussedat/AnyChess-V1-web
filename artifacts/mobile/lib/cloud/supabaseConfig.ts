function readPublic(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/** Public project URL — not a secret. DeepL key must never be read here. */
export function resolveSupabaseUrl(): string | null {
  return (
    readPublic(process.env.EXPO_PUBLIC_SUPABASE_URL) ??
    readPublic(process.env.ANYCHESS_SUPABASE_URL)
  );
}

/** Anon key is designed for clients and is gated by RLS. Not the service role. */
export function resolveSupabaseAnonKey(): string | null {
  return (
    readPublic(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ??
    readPublic(process.env.ANYCHESS_SUPABASE_ANON_KEY)
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}

/**
 * Where Supabase sends the browser after it verifies an email link
 * (signup confirmation and password recovery).
 *
 * `EXPO_PUBLIC_AUTH_CONFIRM_URL` is the readable HTTPS page on the existing
 * web host (`GET /auth/confirm`, `text/html`). It must also be listed in
 * Supabase Redirect URLs. Until that public origin exists, the free
 * `*.supabase.co` function stays the target: it is text/plain, because that
 * domain rewrites HTML.
 */
export function authConfirmRedirectUrl(): string | null {
  const page = readPublic(process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL);
  if (page && /^https:\/\//i.test(page)) return page.replace(/\/$/, '');
  const url = resolveSupabaseUrl();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1/auth-confirm`;
}

export function assertNoDeepLKeyInCloudConfig(): boolean {
  const url = resolveSupabaseUrl() ?? '';
  const anon = resolveSupabaseAnonKey() ?? '';
  return !/deepl|api-free\.deepl/i.test(`${url}${anon}`);
}
