/** Public project URL. Not a secret. */
export const PUBLIC_SUPABASE_URL = 'https://zqfxnzwtptepulmgpxhb.supabase.co';

/**
 * Edge function that verifies the fragment token. The anon key stays in the
 * function's injected environment and is never written into the HTML page.
 */
export const PUBLIC_VERIFY_URL = `${PUBLIC_SUPABASE_URL}/functions/v1/auth-confirm`;

/**
 * Logo already published on jsDelivr from the commit that added the brand file.
 * Immutable, so the page does not depend on `main`.
 */
export const PUBLIC_LOGO_URL =
  'https://cdn.jsdelivr.net/gh/FlorianAussedat/AnyChess-V1-web@43cd85cd3f2d6e9944106864fecaa7de527fc7b0/artifacts/mobile/server/brand/anychess-logo.png';

/**
 * Readable confirmation page. The slash in the branch name stays percent-encoded
 * (`cursor%2F…`). jsDelivr returns 404 if that `%2F` is decoded to `/`.
 * After this file is pushed, the commit-SHA URL of the same path is the Site URL
 * to paste in Supabase: it has no encoded slash.
 */
export const PUBLIC_CONFIRM_PAGE_URL =
  'https://cdn.jsdelivr.net/gh/FlorianAussedat/AnyChess-V1-web@cursor%2Fauth-confirm-page-90c2/site/auth/confirm.html';

/**
 * Where a browser that still lands on the edge function should go.
 * Only `client=dev` is kept; every other value becomes the standalone app.
 * Tokens are never copied onto this URL.
 */
export function confirmPageRedirect(requestUrl: string, pageUrl = PUBLIC_CONFIRM_PAGE_URL): string {
  const incoming = new URL(requestUrl);
  const target = new URL(pageUrl);
  const client = (incoming.searchParams.get('client') || '').toLowerCase();
  const lang = (incoming.searchParams.get('lang') || '').toLowerCase();
  target.search = '';
  target.hash = '';
  target.searchParams.set('client', client === 'dev' ? 'dev' : 'app');
  if (lang === 'en' || lang === 'fr') target.searchParams.set('lang', lang);
  return target.toString();
}
