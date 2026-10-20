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

/** Development diagnostic. Names the missing variables and never prints their values. */
export function logMissingSupabaseConfig(): void {
  if (isSupabaseConfigured()) return;
  const dev = typeof __DEV__ === 'undefined' || __DEV__ === true;
  if (!dev) return;
  const missing: string[] = [];
  if (!resolveSupabaseUrl()) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!resolveSupabaseAnonKey()) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.warn(
    `[anychess] Supabase client is not configured. Missing ${missing.join(' and ') || 'public project settings'}.`,
  );
}

export function deleteAccountFunctionUrl(): string | null {
  const url = resolveSupabaseUrl();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1/delete-account`;
}

export type AuthClientVariant = 'app' | 'dev';
export type AuthMailLanguage = 'fr' | 'en';

/**
 * HTML confirmation page on the connected Netlify site.
 * AnyChess Dev uses it when the bundle does not override
 * `EXPO_PUBLIC_AUTH_CONFIRM_URL`. No query: `client` and `lang` are added below.
 */
export const DEV_AUTH_CONFIRM_PAGE_URL = 'https://sparkly-paprenjak-65f499.netlify.app/auth/confirm';

/**
 * `dev` is AnyChess Dev (`com.anychess.dev`, scheme `anychessdev` / `exp+anychessdev`).
 * `app` is AnyChess Stable (`com.anychess.app`, scheme `mobile`).
 * The historical package `com.anychess.standalone` stays on `client=standalone`.
 */
export function authClientVariant(): AuthClientVariant {
  const raw = readPublic(process.env.EXPO_PUBLIC_APP_CLIENT)?.toLowerCase();
  if (raw === 'dev' || raw === 'app') return raw;
  const dev = typeof __DEV__ !== 'undefined' && __DEV__ === true;
  return dev ? 'dev' : 'app';
}

export function authMailLanguage(value: string | null | undefined): AuthMailLanguage {
  return value?.trim().toLowerCase() === 'en' ? 'en' : 'fr';
}

/**
 * Where Supabase sends the browser after it verifies an email link
 * (signup confirmation and password recovery).
 *
 * `EXPO_PUBLIC_AUTH_CONFIRM_URL` is the Netlify page (`text/html`),
 * `https://sparkly-paprenjak-65f499.netlify.app/auth/confirm`. A path ending in
 * `/auth/confirm` or `/auth/confirm.html` is accepted. It must also be listed
 * in Supabase Redirect URLs, including the `client` and `lang` query.
 *
 * AnyChess Dev (`EXPO_PUBLIC_APP_CLIENT=dev`, or a Metro bundle where `__DEV__`
 * is true) uses that Netlify page even when the variable is unset, and sends
 * `client=dev`. The standalone bundle keeps the function URL until the variable
 * is set, so an already shipped APK is not involved.
 *
 * Query values are only the allowlisted client and language. They are not a
 * scheme, a package, or a token.
 */
export function authConfirmRedirectUrl(language?: string | null): string | null {
  const configured = readPublic(process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL);
  const page = configured ?? (authClientVariant() === 'dev' ? DEV_AUTH_CONFIRM_PAGE_URL : null);
  if (page && /^https:\/\//i.test(page)) {
    try {
      const url = new URL(page);
      const path = url.pathname.replace(/\/$/, '');
      if (url.protocol === 'https:' && /\/auth\/confirm(?:\.html)?$/.test(path)) {
        url.pathname = path;
        url.search = '';
        url.hash = '';
        url.searchParams.set('client', authClientVariant());
        url.searchParams.set('lang', authMailLanguage(language));
        return url.toString();
      }
    } catch {
      // fall through to the text function
    }
  }
  const url = resolveSupabaseUrl();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1/auth-confirm`;
}

export function assertNoDeepLKeyInCloudConfig(): boolean {
  const url = resolveSupabaseUrl() ?? '';
  const anon = resolveSupabaseAnonKey() ?? '';
  return !/deepl|api-free\.deepl/i.test(`${url}${anon}`);
}
