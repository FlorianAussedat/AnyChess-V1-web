/** Public project URL. Not a secret. */
export const PUBLIC_SUPABASE_URL = 'https://zqfxnzwtptepulmgpxhb.supabase.co';

/**
 * Edge function that verifies the fragment token. The anon key stays in the
 * function's injected environment and is never written into the HTML page.
 */
export const PUBLIC_VERIFY_URL = `${PUBLIC_SUPABASE_URL}/functions/v1/auth-confirm`;

/** Connected Netlify site. The hostname is part of the public page URL. */
export const CONFIRM_SITE_HOST = 'sparkly-paprenjak-65f499.netlify.app';
export const CONFIRM_SITE_ORIGIN = `https://${CONFIRM_SITE_HOST}`;

/** Readable HTML page. Netlify serves it as text/html. */
export const PUBLIC_CONFIRM_PAGE_URL = `${CONFIRM_SITE_ORIGIN}/auth/confirm`;

/** Same-origin logo copied into the Netlify publish directory. */
export const PUBLIC_LOGO_PATH = '/brand/anychess-logo.png';

/** Absolute logo for email clients, which cannot use a site-relative path. */
export const PUBLIC_LOGO_URL = `${CONFIRM_SITE_ORIGIN}${PUBLIC_LOGO_PATH}`;

/**
 * Browsers that open the Netlify page may call the edge function.
 * Only this site and its Netlify preview hostnames are accepted.
 */
export function allowedConfirmOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (host === CONFIRM_SITE_HOST || host.endsWith(`--${CONFIRM_SITE_HOST}`)) return url.origin;
  return null;
}

/**
 * Where a browser that still lands on the edge function should go.
 * Preview and Dev are kept explicitly; historical default behavior remains app.
 * Tokens are never copied onto this URL.
 */
export function confirmPageRedirect(requestUrl: string, pageUrl = PUBLIC_CONFIRM_PAGE_URL): string {
  const incoming = new URL(requestUrl);
  const target = new URL(pageUrl);
  const client = (incoming.searchParams.get('client') || '').toLowerCase();
  const lang = (incoming.searchParams.get('lang') || '').toLowerCase();
  target.search = '';
  target.hash = '';
  target.searchParams.set('client', client === 'preview' ? 'preview' : client === 'dev' ? 'dev' : 'app');
  if (lang === 'en' || lang === 'fr') target.searchParams.set('lang', lang);
  return target.toString();
}
